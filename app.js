/**
 * TopoTerra Civil Pro - Main Application Controller
 * Coordinación de eventos, UI reactiva, vistas, modales y vinculación total de componentes
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicializar Estado
  AppState.init();

  // 2. Componentes Visuales
  const viewer2D = new TerrainViewer2D('canvas-terrain-2d', 'container-canvas-2d');
  const viewer3D = new TerrainViewer3D('container-webgl-3d');
  const charts = new DashboardCharts();

  // Toast Helper
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // 3. Manejadores de Pestañas (Tab Navigation)
  const navButtons = document.querySelectorAll('.sidebar-nav .nav-item');
  const viewSections = document.querySelectorAll('.view-section');

  function switchTab(targetTab) {
    navButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === targetTab);
    });
    viewSections.forEach(sec => {
      sec.classList.toggle('active', sec.id === `view-${targetTab}`);
    });
    AppState.activeTab = targetTab;

    // Actualizaciones según vista activa
    if (targetTab === 'visualizador') {
      setTimeout(() => {
        if (viewer2D) viewer2D.resize();
        if (viewer3D) viewer3D.onResize();
      }, 50);
    } else if (targetTab === 'analisis' || targetTab === 'resumen') {
      updateProfileSelectors();
      setTimeout(() => charts.updateAll(), 50);
    } else if (targetTab === 'informes') {
      renderTechnicalReport();
    } else if (targetTab === 'tests') {
      renderUnitTests();
    } else if (targetTab === 'escenarios') {
      renderScenariosTable();
    } else if (targetTab === 'proyectos') {
      renderProjectsTable();
    } else if (targetTab === 'calculadora') {
      updateCalcPanels();
      renderPointsTable();
    }
  }

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  // Botones de navegación en encabezado de Resumen General
  const btnResumenEdit = document.getElementById('btn-resumen-edit-data');
  if (btnResumenEdit) {
    btnResumenEdit.addEventListener('click', () => {
      AppState.setTab('calculadora');
    });
  }

  const btnResumenOpen3D = document.getElementById('btn-resumen-open-3d');
  if (btnResumenOpen3D) {
    btnResumenOpen3D.addEventListener('click', () => {
      AppState.setTab('visualizador');
      if (visTab3D) visTab3D.click();
      if (viewer3D) {
        setTimeout(() => {
          viewer3D.onResize();
          viewer3D.updateModel();
        }, 60);
      }
    });
  }

  // Tema Claro / Oscuro
  const btnToggleTheme = document.getElementById('btn-toggle-theme');
  if (btnToggleTheme) {
    btnToggleTheme.addEventListener('click', () => {
      AppState.toggleTheme();
      showToast(`Tema ${AppState.theme === 'dark' ? 'Oscuro' : 'Claro'} activado`, 'info');
    });
  }

  // 4. Selector de Proyecto Superior y Modo de Cálculo
  const selectProject = document.getElementById('select-active-project');
  function populateProjectSelector() {
    if (!selectProject) return;
    selectProject.innerHTML = '';
    AppState.projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      opt.selected = p.id === AppState.activeProjectId;
      selectProject.appendChild(opt);
    });
  }

  if (selectProject) {
    selectProject.addEventListener('change', (e) => {
      AppState.setActiveProject(e.target.value);
      updateProfileSelectors();
      showToast(`Proyecto activo: ${AppState.getActiveProject().name}`, 'success');
    });
  }

  // Alternar Modo Malla / Modo Simple desde el Badge de Cabecera o icono
  const topbarModeBadge = document.getElementById('topbar-mode-badge');
  if (topbarModeBadge) {
    topbarModeBadge.addEventListener('click', () => {
      AppState.toggleProjectMode();
      updateCalcPanels();
      updateSummaryView();
      const currentMode = AppState.getActiveProject().mode;
      showToast(`Modo cambiado a: ${currentMode === 'advanced' ? 'Malla Avanzada' : 'Simple Uniforme'}`, 'info');
    });
  }

  const projectFolderIcon = document.querySelector('.project-selector svg');
  if (projectFolderIcon) {
    projectFolderIcon.style.cursor = 'pointer';
    projectFolderIcon.setAttribute('title', 'Alternar modo de cálculo');
    projectFolderIcon.addEventListener('click', () => {
      AppState.toggleProjectMode();
      updateCalcPanels();
      updateSummaryView();
    });
  }

  // Botón 'Nuevo' de Cabecera
  const btnQuickNewProj = document.getElementById('btn-quick-new-proj');
  if (btnQuickNewProj) {
    btnQuickNewProj.addEventListener('click', () => {
      const name = prompt("Ingrese el nombre para el nuevo proyecto en blanco:", "Nuevo Proyecto Topográfico");
      if (name !== null) {
        AppState.createBlankProject(name || "Nuevo Proyecto Topográfico");
        document.querySelectorAll('form').forEach(f => f.reset());
        populateProjectSelector();
        updateProfileSelectors();
        switchTab('calculadora');
        showToast("Proyecto en blanco creado. Ingrese o importe sus cotas topográficas.", "success");
      }
    });
  }

  // Botón 'Ejemplo' de Cabecera (Restaurar demostración)
  const btnRestoreDefaults = document.getElementById('btn-restore-defaults');
  if (btnRestoreDefaults) {
    btnRestoreDefaults.addEventListener('click', () => {
      if (confirm("¿Desea restaurar todos los proyectos y ejemplos originales? Los datos no respaldados se restablecerán.")) {
        AppState.resetToDefaults();
        populateProjectSelector();
        updateProfileSelectors();
        updateSummaryView();
        updateCalcPanels();
        renderScenariosTable();
        renderProjectsTable();
        renderUnitTests();
        charts.updateAll();
        if (viewer2D) viewer2D.fitToView();
        if (viewer3D) viewer3D.resetCamera();
        switchTab('resumen');
        showToast("Proyectos y demostraciones técnicas restaurados con éxito", "info");
      }
    });
  }

  // Botón 'Imprimir Informe' de Cabecera
  const btnQuickPrint = document.getElementById('btn-quick-print');
  if (btnQuickPrint) {
    btnQuickPrint.addEventListener('click', () => {
      switchTab('informes');
      setTimeout(() => {
        showToast("Generando Memoria Técnica en PDF...", "info");
        ReportExporter.exportToPDF();
      }, 200);
    });
  }

  // 5. Actualización de Resumen, KPIs y Badge de Balance
  function updateSummaryView() {
    const proj = AppState.getActiveProject();
    const res = AppState.currentResults;
    if (!proj || !res) return;

    // Encabezados
    const resProjName = document.getElementById('resumen-proj-name');
    const resProjDesc = document.getElementById('resumen-proj-desc');
    if (resProjName) resProjName.textContent = proj.name;
    if (resProjDesc) resProjDesc.textContent = `${proj.location || 'Córdoba, Argentina'} — ${proj.description || ''}`;

    // Topbar Pill & Balance en tiempo real: V_corte - V_relleno
    const topbarPill = document.getElementById('topbar-balance-pill');
    const topbarText = document.getElementById('topbar-balance-text');
    const modeBadge = document.getElementById('topbar-mode-badge');
    const badgeCalcMode = document.getElementById('badge-calc-mode');

    const netVal = res.cutVolume - res.fillVolume;
    const netSign = netVal >= 0 ? '+' : '';
    const formattedNet = `${netSign}${netVal.toLocaleString('es-AR', { maximumFractionDigits: 1 })} m³`;

    if (topbarPill && topbarText) {
      if (netVal > 0.05) {
        topbarPill.className = 'balance-pill surplus';
        topbarText.innerHTML = `<strong>⬆ Sobrante (Corte):</strong> ${formattedNet}`;
      } else if (netVal < -0.05) {
        topbarPill.className = 'balance-pill deficit';
        topbarText.innerHTML = `<strong>⬇ Faltante (Relleno):</strong> ${formattedNet}`;
      } else {
        topbarPill.className = 'balance-pill balanced';
        topbarText.innerHTML = `<strong>⚖ Compensado:</strong> 0.0 m³`;
      }
    }

    if (modeBadge) {
      if (proj.mode === 'advanced') {
        modeBadge.textContent = 'Modo Malla Avanzada';
        modeBadge.className = 'mode-badge advanced';
      } else {
        modeBadge.textContent = 'Modo Simple Uniforme';
        modeBadge.className = 'mode-badge simple';
      }
    }

    if (badgeCalcMode) {
      badgeCalcMode.textContent = proj.mode === 'advanced' ? 'Malla' : 'Simple';
    }

    // KPI Cards
    const kpiCutVol = document.getElementById('kpi-cut-vol');
    const kpiCutArea = document.getElementById('kpi-cut-area');
    const kpiCutDepth = document.getElementById('kpi-cut-depth');
    if (kpiCutVol) kpiCutVol.textContent = res.cutVolume.toLocaleString('es-AR', { maximumFractionDigits: 1 });
    if (kpiCutArea) kpiCutArea.textContent = `${res.cutArea.toLocaleString('es-AR', { maximumFractionDigits: 0 })} m²`;
    if (kpiCutDepth) kpiCutDepth.textContent = `${(res.avgCut || res.avgCutDepth || 0).toFixed(2)} m`;

    const kpiFillVol = document.getElementById('kpi-fill-vol');
    const kpiFillArea = document.getElementById('kpi-fill-area');
    const kpiFillHeight = document.getElementById('kpi-fill-height');
    if (kpiFillVol) kpiFillVol.textContent = res.fillVolume.toLocaleString('es-AR', { maximumFractionDigits: 1 });
    if (kpiFillArea) kpiFillArea.textContent = `${res.fillArea.toLocaleString('es-AR', { maximumFractionDigits: 0 })} m²`;
    if (kpiFillHeight) kpiFillHeight.textContent = `${(res.avgFill || res.avgFillHeight || 0).toFixed(2)} m`;

    const kpiNetBalance = document.getElementById('kpi-net-balance');
    const kpiBalanceStatus = document.getElementById('kpi-balance-status');
    const kpiPctDiff = document.getElementById('kpi-pct-diff');
    if (kpiNetBalance) kpiNetBalance.textContent = formattedNet;
    if (kpiBalanceStatus) {
      kpiBalanceStatus.textContent = netVal > 0.05 ? 'Sobra Tierra (Desmonte)' : (netVal < -0.05 ? 'Falta Tierra (Terraplén)' : 'Compensado');
    }

    const diffPct = res.totalVolume > 0 ? ((Math.abs(res.netBalance) / res.totalVolume) * 100).toFixed(1) : '0';
    if (kpiPctDiff) kpiPctDiff.textContent = `${diffPct}%`;

    const kpiTotalVol = document.getElementById('kpi-total-vol');
    const kpiSurfaceArea = document.getElementById('kpi-surface-area');
    const kpiTrucks = document.getElementById('kpi-trucks');
    if (kpiTotalVol) kpiTotalVol.textContent = res.totalVolume.toLocaleString('es-AR', { maximumFractionDigits: 1 });
    const surfArea = proj.mode === 'advanced' ? res.surfaceArea : res.area;
    if (kpiSurfaceArea) kpiSurfaceArea.textContent = `${(surfArea || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })} m²`;
    if (kpiTrucks) kpiTrucks.textContent = `${res.truckLoads || 0} vjes`;

    // Resumen Metodológico
    const resMethodBadge = document.getElementById('resumen-method-badge');
    const resTotalPoints = document.getElementById('resumen-total-points');
    const resElevRange = document.getElementById('resumen-elev-range');
    const resFactors = document.getElementById('resumen-factors');
    const resActiveSc = document.getElementById('resumen-active-scenario');

    if (resMethodBadge) resMethodBadge.textContent = proj.mode === 'advanced' ? 'Método de Prismas TIN' : 'Uniforme Preliminar';
    if (resTotalPoints) resTotalPoints.textContent = proj.mode === 'advanced' ? `${res.totalPoints} puntos (${res.totalCells} celdas)` : '1 macro-zona';
    if (resElevRange) {
      if (proj.mode === 'advanced') {
        resElevRange.textContent = `${(res.minZNat || 0).toFixed(2)}m a ${(res.maxZNat || 0).toFixed(2)}m`;
      } else {
        resElevRange.textContent = `${(proj.simpleData ? proj.simpleData.zNatural : 100)}m`;
      }
    }
    if (resFactors) resFactors.textContent = `+${proj.bulkingFactor || 15}% / +${proj.shrinkageFactor || 10}%`;

    const activeSc = (proj.scenarios || []).find(s => s.id === AppState.activeScenarioId);
    if (resActiveSc) resActiveSc.textContent = activeSc ? activeSc.name : 'Rasante Base';
  }

  // 6. Vista Calculadora - Alternancia Simple / Avanzado y Paneles
  const calcSwitchAdv = document.getElementById('calc-switch-advanced');
  const calcSwitchSim = document.getElementById('calc-switch-simple');
  const panelAdv = document.getElementById('panel-calc-advanced');
  const panelSim = document.getElementById('panel-calc-simple');

  function updateCalcPanels() {
    const proj = AppState.getActiveProject();
    if (!proj) return;

    if (proj.mode === 'advanced') {
      if (calcSwitchAdv) calcSwitchAdv.className = 'btn btn-secondary btn-sm';
      if (calcSwitchSim) calcSwitchSim.className = 'btn btn-outline btn-sm';
      if (panelAdv) panelAdv.style.display = 'block';
      if (panelSim) panelSim.style.display = 'none';
      renderPointsTable();
    } else {
      if (calcSwitchAdv) calcSwitchAdv.className = 'btn btn-outline btn-sm';
      if (calcSwitchSim) calcSwitchSim.className = 'btn btn-secondary btn-sm';
      if (panelAdv) panelAdv.style.display = 'none';
      if (panelSim) panelSim.style.display = 'block';
      if (proj.simpleData) {
        const inpArea = document.getElementById('input-simple-area');
        const inpZnat = document.getElementById('input-simple-znat');
        const inpZproj = document.getElementById('input-simple-zproj');
        const inpBulking = document.getElementById('input-simple-bulking');
        const inpShrinkage = document.getElementById('input-simple-shrinkage');
        if (inpArea) inpArea.value = proj.simpleData.area;
        if (inpZnat) inpZnat.value = proj.simpleData.zNatural;
        if (inpZproj) inpZproj.value = proj.simpleData.zProject;
        if (inpBulking) inpBulking.value = proj.simpleData.bulkingFactor || 15;
        if (inpShrinkage) inpShrinkage.value = proj.simpleData.shrinkageFactor || 10;
      }
    }
  }

  if (calcSwitchAdv) {
    calcSwitchAdv.addEventListener('click', () => {
      const proj = AppState.getActiveProject();
      if (proj.mode !== 'advanced') {
        proj.mode = 'advanced';
        if (!proj.points || proj.points.length === 0) {
          proj.grid = { rows: 11, cols: 11, dx: 5, dy: 5, terrainType: 'rolling', baseZ: 100 };
          proj.points = EarthworkMath.generateSyntheticTerrain(11, 11, 5, 5, 'rolling', 100);
        }
        AppState.recalculate();
        updateCalcPanels();
        updateProfileSelectors();
        showToast("Cambiado a Modo Avanzado con Malla de Puntos", "info");
      }
    });
  }

  if (calcSwitchSim) {
    calcSwitchSim.addEventListener('click', () => {
      const proj = AppState.getActiveProject();
      if (proj.mode !== 'simple') {
        proj.mode = 'simple';
        if (!proj.simpleData) {
          proj.simpleData = { area: 2500, zNatural: 102.5, zProject: 101.8, bulkingFactor: 15, shrinkageFactor: 10 };
        }
        AppState.recalculate();
        updateCalcPanels();
        showToast("Cambiado a Modo Simple Uniforme", "info");
      }
    });
  }

  const btnCalcSimpleApply = document.getElementById('btn-calc-simple-apply');
  if (btnCalcSimpleApply) {
    btnCalcSimpleApply.addEventListener('click', () => {
      const area = Number(document.getElementById('input-simple-area').value);
      const zNat = Number(document.getElementById('input-simple-znat').value);
      const zProj = Number(document.getElementById('input-simple-zproj').value);
      const bulking = Number(document.getElementById('input-simple-bulking').value);
      const shrinkage = Number(document.getElementById('input-simple-shrinkage').value);

      AppState.updateSimpleData({ area, zNatural: zNat, zProject: zProj, bulkingFactor: bulking, shrinkageFactor: shrinkage });
      showToast("Volúmenes calculados con éxito", "success");
    });
  }

  // Generadores rápidos de relieve sintético
  const btnGenRolling = document.getElementById('btn-gen-rolling');
  if (btnGenRolling) {
    btnGenRolling.addEventListener('click', () => {
      const proj = AppState.getActiveProject();
      proj.points = EarthworkMath.generateSyntheticTerrain(proj.grid.rows, proj.grid.cols, proj.grid.dx, proj.grid.dy, 'rolling', 100);
      AppState.recalculate();
      renderPointsTable();
      showToast("Relieve ondulado serrano generado", "info");
    });
  }

  const btnGenSlope = document.getElementById('btn-gen-slope');
  if (btnGenSlope) {
    btnGenSlope.addEventListener('click', () => {
      const proj = AppState.getActiveProject();
      proj.points = EarthworkMath.generateSyntheticTerrain(proj.grid.rows, proj.grid.cols, proj.grid.dx, proj.grid.dy, 'slope', 100);
      AppState.recalculate();
      renderPointsTable();
      showToast("Plataforma horizontal en ladera generada", "info");
    });
  }

  const btnAutoBalanceGrade = document.getElementById('btn-auto-balance-grade');
  if (btnAutoBalanceGrade) {
    btnAutoBalanceGrade.addEventListener('click', () => {
      const proj = AppState.getActiveProject();
      const optZ = EarthworkMath.findBalancedGradeElevation(proj);
      proj.points.forEach(p => { p.zProj = optZ; });
      AppState.recalculate();
      renderPointsTable();
      showToast(`Rasante compensada automáticamente a cota ${optZ} m (Corte ≈ Relleno)`, "success");
    });
  }

  // 7. Tabla de Puntos con Edición Directa Desbloqueada
  const pointsTableBody = document.getElementById('points-table-body');
  const searchPointInput = document.getElementById('table-search-point');

  function renderPointsTable() {
    if (!pointsTableBody) return;
    const gridData = AppState.getEffectiveGridData();
    if (!gridData) return;

    const calcGridSizeLabel = document.getElementById('calc-grid-size-label');
    if (calcGridSizeLabel) {
      calcGridSizeLabel.textContent = `${gridData.cols} x ${gridData.rows} puntos (paso dx=${gridData.dx}m, dy=${gridData.dy}m)`;
    }

    const query = (searchPointInput && searchPointInput.value || '').trim().toLowerCase();
    const pts = gridData.points.filter(p => !query || p.id.toLowerCase().includes(query));

    const tableCountLabel = document.getElementById('table-count-label');
    if (tableCountLabel) {
      tableCountLabel.textContent = `Mostrando: ${pts.length} de ${gridData.points.length}`;
    }

    // Renderizar primeros 120 para máxima agilidad en el DOM
    const slice = pts.slice(0, 120);
    pointsTableBody.innerHTML = slice.map(pt => {
      const delta = pt.zNat - pt.zProj;
      const sign = delta >= 0 ? '+' : '';
      const badgeCls = delta > 0.02 ? 'cut' : (delta < -0.02 ? 'fill' : 'balance');
      const badgeText = delta > 0.02 ? 'CORTE' : (delta < -0.02 ? 'RELLENO' : 'EQUILIBRIO');

      return `
        <tr data-point-id="${pt.id}">
          <td class="font-mono" style="font-weight: 600;">${pt.id}</td>
          <td class="font-mono">${pt.x.toFixed(1)}</td>
          <td class="font-mono">${pt.y.toFixed(1)}</td>
          <td>
            <input type="number" step="0.01" class="table-inline-input inline-znat" value="${pt.zNat.toFixed(2)}" data-id="${pt.id}" title="Editar cota natural directamente">
          </td>
          <td>
            <input type="number" step="0.01" class="table-inline-input inline-zproj" value="${pt.zProj.toFixed(2)}" data-id="${pt.id}" title="Editar cota rasante directamente">
          </td>
          <td class="font-mono cell-delta" style="font-weight: 700;">${sign}${delta.toFixed(2)}</td>
          <td><span class="table-badge ${badgeCls} cell-badge">${badgeText}</span></td>
          <td style="text-align: right;">
            <button class="btn btn-outline btn-sm btn-edit-point" data-id="${pt.id}">Detalle</button>
          </td>
        </tr>
      `;
    }).join('');

    // Edición Directa en Celda: Natural y Rasante
    pointsTableBody.querySelectorAll('.inline-znat').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
          AppState.updatePointElevation(id, val, undefined);
          showToast(`Cota Znat de ${id} actualizada a ${val.toFixed(2)} m`, "info");
        }
      });
    });

    pointsTableBody.querySelectorAll('.inline-zproj').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
          AppState.updatePointElevation(id, undefined, val);
          showToast(`Cota Zproj de ${id} actualizada a ${val.toFixed(2)} m`, "info");
        }
      });
    });

    // Eventos de Detalle / Modal
    pointsTableBody.querySelectorAll('.btn-edit-point').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openEditPointModal(id);
      });
    });
  }

  if (searchPointInput) {
    searchPointInput.addEventListener('input', () => renderPointsTable());
  }

  // 8. Botón 'Importar CSV' en Calculadora con Selector de Archivos Local
  const btnOpenCsvModal = document.getElementById('btn-open-csv-modal');
  const inputDirectCsvCalc = document.getElementById('input-direct-csv-calc');

  if (btnOpenCsvModal && inputDirectCsvCalc) {
    btnOpenCsvModal.addEventListener('click', () => {
      inputDirectCsvCalc.click();
    });

    inputDirectCsvCalc.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          AppState.importFromCSV(event.target.result);
          renderPointsTable();
          updateProfileSelectors();
          showToast(`CSV procesado con éxito. Puntos topográficos inyectados a la malla.`, "success");
        } catch (err) {
          alert("Error al importar CSV: " + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  // 9. Visualizador 2D / 3D
  const visTab2D = document.getElementById('vis-tab-2d');
  const visTab3D = document.getElementById('vis-tab-3d');
  const visCont2D = document.getElementById('vis-container-2d');
  const visCont3D = document.getElementById('vis-container-3d');

  if (visTab2D && visTab3D) {
    visTab2D.addEventListener('click', () => {
      visTab2D.className = 'btn btn-secondary btn-sm';
      visTab3D.className = 'btn btn-outline btn-sm';
      if (visCont2D) visCont2D.style.display = 'block';
      if (visCont3D) visCont3D.style.display = 'none';
      viewer2D.resize();
    });

    visTab3D.addEventListener('click', () => {
      visTab2D.className = 'btn btn-outline btn-sm';
      visTab3D.className = 'btn btn-secondary btn-sm';
      if (visCont2D) visCont2D.style.display = 'none';
      if (visCont3D) visCont3D.style.display = 'block';
      viewer3D.onResize();
    });
  }

  const btn2DFit = document.getElementById('btn-2d-fit');
  if (btn2DFit) btn2DFit.addEventListener('click', () => viewer2D.fitToView());

  const btn2DToggleLabels = document.getElementById('btn-2d-toggle-labels');
  if (btn2DToggleLabels) {
    btn2DToggleLabels.addEventListener('click', () => {
      viewer2D.showLabels = !viewer2D.showLabels;
      viewer2D.render();
      showToast(`Etiquetas de cota: ${viewer2D.showLabels ? 'Activadas (con filtro de zoom)' : 'Ocultas'}`, "info");
    });
  }

  const btn2DToggleGrid = document.getElementById('btn-2d-toggle-grid');
  if (btn2DToggleGrid) {
    btn2DToggleGrid.addEventListener('click', () => {
      viewer2D.showGrid = !viewer2D.showGrid;
      viewer2D.render();
    });
  }

  // Controles 3D
  const btn3DResetCam = document.getElementById('btn-3d-reset-cam');
  if (btn3DResetCam) btn3DResetCam.addEventListener('click', () => viewer3D.resetCamera());

  const sliderExag = document.getElementById('slider-vertical-exag');
  if (sliderExag) {
    sliderExag.addEventListener('input', (e) => {
      document.getElementById('label-exag-val').textContent = `${e.target.value}x`;
      viewer3D.setVerticalExaggeration(e.target.value);
    });
  }

  const sliderOpacity = document.getElementById('slider-grade-opacity');
  if (sliderOpacity) {
    sliderOpacity.addEventListener('input', (e) => {
      document.getElementById('label-opacity-val').textContent = `${Math.round(e.target.value * 100)}%`;
      viewer3D.setGradeOpacity(e.target.value);
    });
  }

  const checkShowTerrain = document.getElementById('check-show-terrain');
  if (checkShowTerrain) checkShowTerrain.addEventListener('change', (e) => viewer3D.toggleTerrain(e.target.checked));

  const checkShowGrade = document.getElementById('check-show-grade');
  if (checkShowGrade) checkShowGrade.addEventListener('change', (e) => viewer3D.toggleGrade(e.target.checked));

  const checkShowPrisms = document.getElementById('check-show-prisms');
  if (checkShowPrisms) checkShowPrisms.addEventListener('change', (e) => viewer3D.togglePrisms(e.target.checked));

  const checkShowWireframe = document.getElementById('check-show-wireframe');
  if (checkShowWireframe) checkShowWireframe.addEventListener('change', (e) => viewer3D.toggleWireframe(e.target.checked));

  // Ficha Técnica de Punto Seleccionado
  AppState.subscribe((event, data) => {
    if (event === 'point_selected') {
      const pt = data.point;
      const infoPtId = document.getElementById('info-pt-id');
      const infoPtXy = document.getElementById('info-pt-xy');
      const infoPtZnat = document.getElementById('info-pt-znat');
      const infoPtZproj = document.getElementById('info-pt-zproj');
      const infoPtDelta = document.getElementById('info-pt-delta');
      const statusBadge = document.getElementById('selected-pt-status');
      const infoPtAction = document.getElementById('info-pt-action');

      if (infoPtId) infoPtId.textContent = pt.id;
      if (infoPtXy) infoPtXy.textContent = `X: ${pt.x.toFixed(2)} m, Y: ${pt.y.toFixed(2)} m`;
      if (infoPtZnat) infoPtZnat.textContent = `${pt.zNat.toFixed(2)} m`;
      if (infoPtZproj) infoPtZproj.textContent = `${pt.zProj.toFixed(2)} m`;

      const delta = pt.deltaH;
      const sign = delta >= 0 ? '+' : '';
      if (infoPtDelta) infoPtDelta.textContent = `${sign}${delta.toFixed(2)} m`;

      if (statusBadge) {
        if (delta > 0.02) {
          statusBadge.textContent = 'ZONA DE DESMONTE (CORTE)';
          statusBadge.className = 'table-badge cut';
          if (infoPtAction) infoPtAction.textContent = `Excavar ${delta.toFixed(2)} metros de suelo`;
        } else if (delta < -0.02) {
          statusBadge.textContent = 'ZONA DE TERRAPLÉN (RELLENO)';
          statusBadge.className = 'table-badge fill';
          if (infoPtAction) infoPtAction.textContent = `Aportar ${Math.abs(delta).toFixed(2)} metros de relleno`;
        } else {
          statusBadge.textContent = 'ZONA EQUILIBRADA (COTA CERO)';
          statusBadge.className = 'table-badge balance';
          if (infoPtAction) infoPtAction.textContent = 'Nivelación en equilibrio';
        }
      }
    }
  });

  // 10. Desplegables de Perfiles (Longitudinal y Transversal)
  const selProfRow = document.getElementById('select-profile-row');
  const selProfCol = document.getElementById('select-profile-col');

  function updateProfileSelectors() {
    const gridData = AppState.getEffectiveGridData();
    if (!gridData) return;

    if (selProfRow) {
      selProfRow.innerHTML = '';
      for (let r = 0; r < gridData.rows; r++) {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = `Fila ${r + 1} (Y=${(r * gridData.dy).toFixed(0)}m)`;
        if (AppState.selectedProfile.type === 'longitudinal' && r === AppState.selectedProfile.index) {
          opt.selected = true;
        }
        selProfRow.appendChild(opt);
      }
    }

    if (selProfCol) {
      selProfCol.innerHTML = '';
      for (let c = 0; c < gridData.cols; c++) {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = `Col ${c + 1} (X=${(c * gridData.dx).toFixed(0)}m)`;
        if (AppState.selectedProfile.type === 'transverse' && c === AppState.selectedProfile.index) {
          opt.selected = true;
        }
        selProfCol.appendChild(opt);
      }
    }
  }

  if (selProfRow) {
    selProfRow.addEventListener('change', (e) => {
      const rowIndex = Number(e.target.value);
      AppState.selectedProfile = { type: 'longitudinal', index: rowIndex };
      charts.renderLongitudinalProfile(rowIndex);
      if (viewer2D) viewer2D.render();
    });
  }

  if (selProfCol) {
    selProfCol.addEventListener('change', (e) => {
      const colIndex = Number(e.target.value);
      AppState.selectedProfile = { type: 'transverse', index: colIndex };
      charts.renderTransversalProfile(colIndex);
      if (viewer2D) viewer2D.render();
    });
  }

  // 11. Vista Escenarios de Rasante con Variación Porcentual
  function renderScenariosTable() {
    const tbody = document.getElementById('table-scenarios-body');
    if (!tbody || !AppState.scenarioResults) return;

    tbody.innerHTML = AppState.scenarioResults.map(sc => {
      const isBase = sc.scenario.isBase || sc.scenario.id === 'sc_base';
      const isAuto = sc.scenario.autoBalance;
      const desc = isBase ? 'Base de Referencia' : (isAuto ? 'Equilibrio de Masas' : `Offset ΔZ=${sc.scenario.offsetZ >= 0 ? '+' : ''}${sc.scenario.offsetZ}m`);
      const isActive = sc.scenario.id === AppState.activeScenarioId;
      const varPct = sc.variationPct !== undefined ? sc.variationPct : 0;
      const varSign = varPct > 0 ? '+' : '';
      const varBadge = isBase
        ? `<span class="table-badge balance">Referencia (0.0%)</span>`
        : `<span class="table-badge ${varPct > 0 ? 'cut' : (varPct < 0 ? 'fill' : 'balance')}">${varSign}${varPct}%</span>`;

      return `
        <tr style="${isActive ? 'background: rgba(2, 132, 199, 0.12);' : ''}">
          <td style="font-weight: 600;">
            ${sc.scenario.name} ${isActive ? '<span class="table-badge balance" style="font-size: 10px;">ACTIVO</span>' : ''}
          </td>
          <td>${desc}</td>
          <td class="font-mono">${sc.results.cutVolume.toLocaleString('es-AR', { maximumFractionDigits: 1 })}</td>
          <td class="font-mono">${sc.results.fillVolume.toLocaleString('es-AR', { maximumFractionDigits: 1 })}</td>
          <td class="font-mono" style="font-weight: 700; color: ${sc.results.netBalance >= 0 ? '#ef4444' : '#3b82f6'};">
            ${sc.results.netBalance >= 0 ? '+' : ''}${sc.results.netBalance.toLocaleString('es-AR', { maximumFractionDigits: 1 })}
          </td>
          <td class="font-mono">${sc.results.totalVolume.toLocaleString('es-AR', { maximumFractionDigits: 1 })}</td>
          <td>${varBadge}</td>
          <td class="font-mono">$ ${sc.cost.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td>
          <td style="text-align: right; display: flex; justify-content: flex-end; gap: 4px;">
            ${!isActive ? `<button class="btn btn-primary btn-sm btn-select-scenario" data-id="${sc.scenario.id}">Activar</button>` : ''}
            ${!isBase ? `<button class="btn btn-danger btn-sm btn-delete-scenario" data-id="${sc.scenario.id}">Eliminar</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-select-scenario').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        AppState.setActiveScenario(id);
        showToast("Escenario de rasante activado", "info");
      });
    });

    tbody.querySelectorAll('.btn-delete-scenario').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        AppState.deleteScenario(id);
        renderScenariosTable();
        showToast("Escenario eliminado", "warning");
      });
    });
  }

  // 12. Gestor de Proyectos y Persistencia Local
  function renderProjectsTable() {
    const tbody = document.getElementById('table-projects-body');
    if (!tbody) return;

    tbody.innerHTML = AppState.projects.map(p => {
      const isActive = p.id === AppState.activeProjectId;
      const ptsDesc = p.mode === 'advanced' ? `${p.grid.cols}x${p.grid.rows} pts` : `${(p.simpleData ? p.simpleData.area : 0)} m²`;

      return `
        <tr style="${isActive ? 'background: rgba(2, 132, 199, 0.12);' : ''}">
          <td style="font-weight: 600;">
            ${p.name} ${isActive ? '<span class="table-badge balance" style="font-size: 10px;">ACTUAL</span>' : ''}
          </td>
          <td>${p.location || '-'}</td>
          <td><span class="mode-badge ${p.mode}">${p.mode === 'advanced' ? 'Malla' : 'Simple'}</span></td>
          <td>${p.date || '-'}</td>
          <td class="font-mono">${ptsDesc}</td>
          <td>${p.scenarios ? `${p.scenarios.length} alternativas` : '1 base'}</td>
          <td style="text-align: right; display: flex; justify-content: flex-end; gap: 6px;">
            ${!isActive ? `<button class="btn btn-primary btn-sm btn-switch-proj" data-id="${p.id}">Abrir</button>` : ''}
            <button class="btn btn-secondary btn-sm btn-rename-proj" data-id="${p.id}" data-name="${p.name}">Renombrar</button>
            <button class="btn btn-secondary btn-sm btn-clone-proj" data-id="${p.id}" title="Duplicar proyecto">Duplicar</button>
            ${AppState.projects.length > 1 ? `<button class="btn btn-danger btn-sm btn-delete-proj" data-id="${p.id}" title="Eliminar proyecto">Borrar</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-switch-proj').forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.setActiveProject(btn.getAttribute('data-id'));
        populateProjectSelector();
        updateProfileSelectors();
        showToast("Proyecto cargado con éxito", "success");
      });
    });

    tbody.querySelectorAll('.btn-rename-proj').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const currentName = btn.getAttribute('data-name');
        const modalRename = document.getElementById('modal-rename-project');
        if (modalRename) {
          document.getElementById('rename-proj-id').value = id;
          document.getElementById('rename-proj-name').value = currentName;
          modalRename.classList.add('active');
        } else {
          const newName = prompt("Nuevo nombre del proyecto:", currentName);
          if (newName && newName.trim()) {
            AppState.renameProject(id, newName);
            populateProjectSelector();
            renderProjectsTable();
            showToast("Proyecto renombrado", "success");
          }
        }
      });
    });

    tbody.querySelectorAll('.btn-clone-proj').forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.duplicateProject(btn.getAttribute('data-id'));
        populateProjectSelector();
        renderProjectsTable();
        showToast("Proyecto duplicado", "success");
      });
    });

    tbody.querySelectorAll('.btn-delete-proj').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm("¿Está seguro de eliminar este proyecto? Esta acción no se puede deshacer.")) {
          AppState.deleteProject(btn.getAttribute('data-id'));
          populateProjectSelector();
          renderProjectsTable();
          showToast("Proyecto eliminado", "warning");
        }
      });
    });
  }

  // 13. Memoria Técnica y Descargas
  function renderTechnicalReport() {
    const container = document.getElementById('technical-report-container');
    if (!container) return;
    container.innerHTML = ReportExporter.generateTechnicalReportHTML();
  }

  const btnPrintReportNow = document.getElementById('btn-print-report-now');
  if (btnPrintReportNow) {
    btnPrintReportNow.addEventListener('click', () => {
      showToast("Generando documento PDF...", "info");
      ReportExporter.exportToPDF();
    });
  }

  const btnExportPointsCSV = document.getElementById('btn-export-points-csv');
  if (btnExportPointsCSV) {
    btnExportPointsCSV.addEventListener('click', () => {
      ReportExporter.downloadPointsCSV();
      showToast("CSV de puntos topográficos descargado", "success");
    });
  }

  const btnExportVolumesCSV = document.getElementById('btn-export-volumes-csv');
  if (btnExportVolumesCSV) {
    btnExportVolumesCSV.addEventListener('click', () => {
      ReportExporter.downloadVolumeSummaryCSV();
      showToast("CSV resumido celda por celda descargado", "success");
    });
  }

  const btnExportDXF = document.getElementById('btn-export-dxf');
  if (btnExportDXF) {
    btnExportDXF.addEventListener('click', () => {
      ReportExporter.downloadDXF();
      showToast("Archivo CAD DXF 3D con POINT y 3DFACE descargado", "success");
    });
  }

  // Exportar / Importar JSON
  const btnExportProjJSON = document.getElementById('btn-export-project-json');
  if (btnExportProjJSON) {
    btnExportProjJSON.addEventListener('click', () => {
      AppState.exportToJSON();
      showToast("Archivo JSON de proyecto descargado", "success");
    });
  }

  const inputJsonImport = document.getElementById('input-json-import');
  const btnImportProjJSON = document.getElementById('btn-import-project-json');

  if (btnImportProjJSON && inputJsonImport) {
    btnImportProjJSON.addEventListener('click', () => {
      inputJsonImport.click();
    });

    inputJsonImport.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          AppState.importFromJSON(event.target.result);
          populateProjectSelector();
          updateProfileSelectors();
          showToast("Proyecto importado con éxito desde archivo JSON", "success");
        } catch (err) {
          alert("Error al importar archivo JSON: " + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  // 14. Suite de Tests Unitarios
  function renderUnitTests() {
    const tests = EarthworkMath.runUnitTests();
    const tbody = document.getElementById('table-tests-body');
    const badge = document.getElementById('tests-summary-badge');
    if (!tbody) return;

    const passCount = tests.filter(t => t.pass).length;
    if (badge) {
      badge.textContent = `${passCount} / ${tests.length} Pruebas Exitosas`;
      badge.className = passCount === tests.length ? 'table-badge balance' : 'table-badge cut';
    }

    tbody.innerHTML = tests.map(t => `
      <tr>
        <td style="font-weight: 600;">${t.name}</td>
        <td>
          <span class="table-badge ${t.pass ? 'balance' : 'cut'}">${t.pass ? 'CORRECTO (PASS)' : 'FALLIDO (FAIL)'}</span>
        </td>
        <td class="font-mono" style="font-size: 12px; color: var(--text-secondary);">${t.details}</td>
      </tr>
    `).join('');
  }

  const btnReRunTests = document.getElementById('btn-re-run-tests');
  if (btnReRunTests) {
    btnReRunTests.addEventListener('click', () => {
      renderUnitTests();
      showToast("Suite de pruebas unitarias ejecutada", "success");
    });
  }

  // 15. Modales y Formularios
  function setupModals() {
    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
      });
    });

    // Nuevo Proyecto Modal
    const modalNewProj = document.getElementById('modal-new-project');
    const formNewProj = document.getElementById('form-new-project');
    const btnCreateNewProj = document.getElementById('btn-create-new-project');

    if (btnCreateNewProj && modalNewProj) {
      btnCreateNewProj.addEventListener('click', () => {
        modalNewProj.classList.add('active');
      });
    }

    if (formNewProj) {
      formNewProj.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('new-proj-name').value;
        const location = document.getElementById('new-proj-location').value;
        const description = document.getElementById('new-proj-desc').value;
        const mode = document.getElementById('new-proj-mode').value;
        const terrain = document.getElementById('new-proj-terrain').value;
        const bulking = Number(document.getElementById('new-proj-bulking').value);
        const shrinkage = Number(document.getElementById('new-proj-shrinkage').value);

        AppState.createProject({
          name,
          location,
          description,
          mode,
          bulkingFactor: bulking,
          shrinkageFactor: shrinkage,
          grid: { rows: 11, cols: 11, dx: 5, dy: 5, terrainType: terrain, baseZ: 100 }
        });

        modalNewProj.classList.remove('active');
        formNewProj.reset();
        populateProjectSelector();
        updateProfileSelectors();
        switchTab('resumen');
        showToast(`Proyecto "${name}" creado exitosamente`, "success");
      });
    }

    // Modal Renombrar Proyecto
    const modalRename = document.getElementById('modal-rename-project');
    const formRename = document.getElementById('form-rename-project');
    if (formRename && modalRename) {
      formRename.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('rename-proj-id').value;
        const newName = document.getElementById('rename-proj-name').value;
        AppState.renameProject(id, newName);
        modalRename.classList.remove('active');
        populateProjectSelector();
        renderProjectsTable();
        showToast("Proyecto renombrado con éxito", "success");
      });
    }

    // Modal Nueva Alternativa de Rasante
    const modalNewSc = document.getElementById('modal-new-scenario');
    const formNewSc = document.getElementById('form-new-scenario');
    const btnAddScenarioModal = document.getElementById('btn-add-scenario-modal');

    if (btnAddScenarioModal && modalNewSc) {
      btnAddScenarioModal.addEventListener('click', () => {
        modalNewSc.classList.add('active');
      });
    }

    if (formNewSc && modalNewSc) {
      formNewSc.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('scenario-name').value;
        const offset = Number(document.getElementById('scenario-offset').value);
        AppState.addScenario(name, offset);
        modalNewSc.classList.remove('active');
        formNewSc.reset();
        renderScenariosTable();
        showToast(`Alternativa "${name}" añadida`, "success");
      });
    }

    // Modal Editar Punto Topográfico
    const modalEditPt = document.getElementById('modal-edit-point');
    const formEditPt = document.getElementById('form-edit-point');

    window.openEditPointModal = function (pointId) {
      const proj = AppState.getActiveProject();
      const pt = proj.points.find(p => p.id === pointId);
      if (!pt) return;
      document.getElementById('edit-pt-id').value = pt.id;
      document.getElementById('edit-pt-x').value = pt.x.toFixed(2);
      document.getElementById('edit-pt-y').value = pt.y.toFixed(2);
      document.getElementById('edit-pt-znat').value = pt.zNat;
      document.getElementById('edit-pt-zproj').value = pt.zProj;
      if (modalEditPt) modalEditPt.classList.add('active');
    };

    if (formEditPt && modalEditPt) {
      formEditPt.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-pt-id').value;
        const xVal = parseFloat(document.getElementById('edit-pt-x').value);
        const yVal = parseFloat(document.getElementById('edit-pt-y').value);
        const zNat = parseFloat(document.getElementById('edit-pt-znat').value);
        const zProj = parseFloat(document.getElementById('edit-pt-zproj').value);

        const proj = AppState.getActiveProject();
        const pt = proj.points.find(p => p.id === id);
        if (pt) {
          if (!isNaN(xVal)) pt.x = Number(xVal.toFixed(3));
          if (!isNaN(yVal)) pt.y = Number(yVal.toFixed(3));
        }

        AppState.updatePointElevation(id, zNat, zProj);
        modalEditPt.classList.remove('active');
        renderPointsTable();
        showToast(`Punto ${id} actualizado correctamente`, "success");
      });
    }

    // Modal Importar CSV (Fallback y pegado directo)
    const modalCSV = document.getElementById('modal-import-csv');
    const btnProcessCSV = document.getElementById('btn-process-csv');
    const btnDownloadCSVTemplate = document.getElementById('btn-download-csv-template');

    if (btnProcessCSV) {
      btnProcessCSV.addEventListener('click', () => {
        const fileInput = document.getElementById('input-csv-file');
        const textPaste = document.getElementById('textarea-csv-paste').value.trim();

        if (fileInput && fileInput.files.length > 0) {
          const file = fileInput.files[0];
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              AppState.importFromCSV(e.target.result);
              if (modalCSV) modalCSV.classList.remove('active');
              renderPointsTable();
              updateProfileSelectors();
              showToast("Puntos topográficos importados correctamente", "success");
            } catch (err) {
              alert("Error: " + err.message);
            }
          };
          reader.readAsText(file);
        } else if (textPaste) {
          try {
            AppState.importFromCSV(textPaste);
            if (modalCSV) modalCSV.classList.remove('active');
            renderPointsTable();
            updateProfileSelectors();
            showToast("Puntos topográficos cargados correctamente", "success");
          } catch (err) {
            alert("Error: " + err.message);
          }
        } else {
          alert("Por favor seleccione un archivo CSV o pegue datos en el cuadro de texto.");
        }
      });
    }

    if (btnDownloadCSVTemplate) {
      btnDownloadCSVTemplate.addEventListener('click', () => {
        const template = "X,Y,Z_Natural,Z_Proyecto\n0,0,101.50,100.00\n5,0,102.10,100.00\n10,0,101.80,100.00\n0,5,101.30,100.00\n5,5,102.40,100.00\n10,5,101.90,100.00\n0,10,100.90,100.00\n5,10,101.60,100.00\n10,10,101.20,100.00\n";
        const blob = new Blob([template], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "plantilla_puntos_topoterra.csv";
        a.click();
      });
    }
  }

  // 16. Suscripciones de Estado para Reactividad Global
  AppState.subscribe((event, data) => {
    if (event === 'tab_changed') {
      switchTab(data);
      return;
    }

    updateSummaryView();
    updateCalcPanels();
    renderScenariosTable();
    renderProjectsTable();

    if (AppState.activeTab === 'visualizador') {
      if (viewer2D) viewer2D.render();
      if (viewer3D) viewer3D.updateModel();
    } else if (AppState.activeTab === 'analisis' || AppState.activeTab === 'resumen') {
      charts.updateAll();
    } else if (AppState.activeTab === 'informes') {
      renderTechnicalReport();
    } else if (AppState.activeTab === 'tests') {
      renderUnitTests();
    }
  });

  // Inicialización de Interfaz
  populateProjectSelector();
  setupModals();
  updateSummaryView();
  updateCalcPanels();
  renderScenariosTable();
  renderProjectsTable();
  renderUnitTests();
  updateProfileSelectors();
  charts.updateAll();

  // Atajo de teclado Esc para cerrar modales
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    }
  });
});
