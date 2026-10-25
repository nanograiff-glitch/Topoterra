/**
 * TopoTerra Civil Pro - State Management
 * Manejo centralizado de proyectos, escenarios, persistencia y eventos
 */

class AppStateManager {
  constructor() {
    this.STORAGE_KEY = 'topoterra_projects_v2';
    this.THEME_KEY = 'topoterra_theme';
    this.projects = [];
    this.activeProjectId = null;
    this.activeScenarioId = 'sc_base';
    this.theme = 'dark';
    this.activeTab = 'resumen';
    this.selectedPoint = null;
    this.selectedProfile = { type: 'longitudinal', index: 5 }; // fila central por defecto
    this.currentResults = null;
    this.scenarioResults = [];
    this.listeners = [];
  }

  init() {
    // Cargar tema preferido
    const savedTheme = localStorage.getItem(this.THEME_KEY);
    if (savedTheme) {
      this.theme = savedTheme;
    }
    document.documentElement.setAttribute('data-theme', this.theme);

    // Cargar proyectos de localStorage o restaurar defaults
    const savedProjects = localStorage.getItem(this.STORAGE_KEY);
    if (savedProjects) {
      try {
        this.projects = JSON.parse(savedProjects);
      } catch (e) {
        console.error("Error al cargar proyectos de localStorage, cargando predeterminados.", e);
        this.resetToDefaults();
      }
    }

    if (!this.projects || this.projects.length === 0) {
      this.resetToDefaults();
    } else {
      // Asegurarse de que los proyectos tengan sus puntos generados si fueron guardados
      this.projects.forEach(p => {
        if (p.mode === 'advanced' && (!p.points || p.points.length === 0)) {
          p.points = EarthworkMath.generateSyntheticTerrain(
            p.grid.rows,
            p.grid.cols,
            p.grid.dx,
            p.grid.dy,
            p.grid.terrainType,
            p.grid.baseZ
          );
        }
      });
      this.activeProjectId = this.projects[0].id;
    }

    this.recalculate();
  }

  resetToDefaults() {
    this.projects = JSON.parse(JSON.stringify(APP_CONSTANTS.DEFAULT_PROJECTS));
    this.projects.forEach(p => {
      if (p.mode === 'advanced') {
        p.points = EarthworkMath.generateSyntheticTerrain(
          p.grid.rows,
          p.grid.cols,
          p.grid.dx,
          p.grid.dy,
          p.grid.terrainType,
          p.grid.baseZ
        );
      }
    });
    this.activeProjectId = this.projects[0].id;
    this.activeScenarioId = 'sc_base';
    this.save();
  }

  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.projects));
    } catch (e) {
      console.warn("No se pudo guardar en localStorage (posible límite de cuota superado).", e);
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify(event, data) {
    this.listeners.forEach(cb => {
      try {
        cb(event, data);
      } catch (err) {
        console.error("Error en listener de AppState:", err);
      }
    });
  }

  setTheme(theme) {
    this.theme = theme;
    localStorage.setItem(this.THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
    this.notify('theme_changed', theme);
  }

  toggleTheme() {
    this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
  }

  setTab(tab) {
    this.activeTab = tab;
    this.notify('tab_changed', tab);
  }

  getActiveProject() {
    return this.projects.find(p => p.id === this.activeProjectId) || this.projects[0];
  }

  setActiveProject(id) {
    const proj = this.projects.find(p => p.id === id);
    if (proj) {
      this.activeProjectId = id;
      this.activeScenarioId = (proj.scenarios && proj.scenarios.length > 0) ? proj.scenarios[0].id : 'sc_base';
      this.selectedPoint = null;
      this.recalculate();
      this.notify('project_changed', proj);
    }
  }

  setActiveScenario(scenarioId) {
    this.activeScenarioId = scenarioId;
    this.recalculate();
    this.notify('scenario_changed', scenarioId);
  }

  /**
   * Obtiene la malla de puntos aplicando el offset o cálculo de rasante del escenario activo
   */
  getEffectiveGridData() {
    const project = this.getActiveProject();
    if (project.mode !== 'advanced') return null;

    const basePoints = project.points;
    const scenario = (project.scenarios || []).find(s => s.id === this.activeScenarioId) || { offsetZ: 0 };

    let effectivePoints = basePoints;

    if (scenario.autoBalance) {
      // Calcular cota óptima balanceada
      const optZ = EarthworkMath.findBalancedGradeElevation({
        rows: project.grid.rows,
        cols: project.grid.cols,
        dx: project.grid.dx,
        dy: project.grid.dy,
        points: basePoints
      });
      effectivePoints = basePoints.map(p => ({
        ...p,
        zProj: optZ
      }));
    } else if (scenario.offsetZ && scenario.offsetZ !== 0) {
      effectivePoints = basePoints.map(p => ({
        ...p,
        zProj: Number((p.zProj + scenario.offsetZ).toFixed(3))
      }));
    }

    return {
      rows: project.grid.rows,
      cols: project.grid.cols,
      dx: project.grid.dx,
      dy: project.grid.dy,
      points: effectivePoints
    };
  }

  recalculate() {
    const project = this.getActiveProject();
    if (!project) return;

    if (project.mode === 'simple') {
      this.currentResults = EarthworkMath.calculateSimple(project.simpleData);
      this.scenarioResults = [];
    } else {
      const gridData = this.getEffectiveGridData();
      this.currentResults = EarthworkMath.calculateAdvanced(gridData, {
        bulkingFactor: project.bulkingFactor,
        shrinkageFactor: project.shrinkageFactor
      });

      // Calcular todos los escenarios para la comparativa
      const rawScenarioResults = (project.scenarios || []).map(sc => {
        let scPoints = project.points;
        if (sc.autoBalance) {
          const optZ = EarthworkMath.findBalancedGradeElevation({
            rows: project.grid.rows,
            cols: project.grid.cols,
            dx: project.grid.dx,
            dy: project.grid.dy,
            points: project.points
          });
          scPoints = project.points.map(p => ({ ...p, zProj: optZ }));
        } else if (sc.offsetZ) {
          scPoints = project.points.map(p => ({ ...p, zProj: Number((p.zProj + sc.offsetZ).toFixed(3)) }));
        }

        const scGrid = {
          rows: project.grid.rows,
          cols: project.grid.cols,
          dx: project.grid.dx,
          dy: project.grid.dy,
          points: scPoints
        };

        const res = EarthworkMath.calculateAdvanced(scGrid, {
          bulkingFactor: project.bulkingFactor,
          shrinkageFactor: project.shrinkageFactor
        });

        // Costo estimado
        const cost = (res.cutVolume * (project.unitCutCost || 4500)) + (res.fillVolume * (project.unitFillCost || 5200));

        return {
          scenario: sc,
          results: res,
          cost
        };
      });

      // Calcular variación porcentual respecto a la rasante de referencia (base)
      const baseScItem = rawScenarioResults.find(sr => sr.scenario.isBase || sr.scenario.id === 'sc_base') || rawScenarioResults[0];
      const baseTotalVol = baseScItem ? baseScItem.results.totalVolume : 0;

      this.scenarioResults = rawScenarioResults.map(sr => {
        let variationPct = 0;
        if (baseTotalVol > 0) {
          variationPct = Number((((sr.results.totalVolume - baseTotalVol) / baseTotalVol) * 100).toFixed(1));
        }
        return {
          ...sr,
          variationPct
        };
      });
    }

    this.save();
    this.notify('calculation_updated', this.currentResults);
  }

  toggleProjectMode() {
    const proj = this.getActiveProject();
    if (!proj) return;
    if (proj.mode === 'advanced') {
      proj.mode = 'simple';
      if (!proj.simpleData) {
        proj.simpleData = {
          area: (proj.grid.rows - 1) * proj.grid.dx * (proj.grid.cols - 1) * proj.grid.dy || 2500,
          zNatural: 102.50,
          zProject: 101.80,
          bulkingFactor: proj.bulkingFactor || 15,
          shrinkageFactor: proj.shrinkageFactor || 10
        };
      }
    } else {
      proj.mode = 'advanced';
      if (!proj.points || proj.points.length === 0) {
        proj.grid = proj.grid || { rows: 11, cols: 11, dx: 5, dy: 5, terrainType: 'rolling', baseZ: 100 };
        proj.points = EarthworkMath.generateSyntheticTerrain(
          proj.grid.rows,
          proj.grid.cols,
          proj.grid.dx,
          proj.grid.dy,
          proj.grid.terrainType || 'rolling',
          proj.grid.baseZ || 100
        );
      }
    }
    this.recalculate();
    this.save();
    this.notify('project_updated', proj);
  }

  renameProject(id, newName) {
    const proj = this.projects.find(p => p.id === id);
    if (!proj || !newName || !newName.trim()) return;
    proj.name = newName.trim();
    this.save();
    this.notify('project_updated', proj);
  }

  createBlankProject(name = "Nuevo Proyecto Topográfico") {
    const id = 'proj_' + Date.now();
    const newProj = {
      id,
      name: name.trim() || "Nuevo Proyecto Topográfico",
      location: "Córdoba, Argentina",
      description: "Proyecto en blanco recién creado.",
      date: new Date().toISOString().split('T')[0],
      mode: 'advanced',
      bulkingFactor: 15,
      shrinkageFactor: 10,
      unitCutCost: 4500,
      unitFillCost: 5200,
      grid: {
        rows: 5,
        cols: 5,
        dx: 5,
        dy: 5,
        terrainType: 'flat',
        baseZ: 100
      },
      points: [],
      scenarios: [
        { id: "sc_base", name: "Rasante de Proyecto", offsetZ: 0, isBase: true },
        { id: "sc_opt", name: "Rasante Compensada Óptima", autoBalance: true }
      ]
    };

    // Puntos iniciales planos a cota 100
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        newProj.points.push({
          id: `P-${r + 1}-${c + 1}`,
          row: r,
          col: c,
          x: c * 5,
          y: r * 5,
          zNat: 100.0,
          zProj: 100.0
        });
      }
    }

    this.projects.push(newProj);
    this.setActiveProject(id);
    this.save();
    this.notify('project_created', newProj);
    return newProj;
  }

  updateProjectMetadata(data) {
    const proj = this.getActiveProject();
    if (!proj) return;
    Object.assign(proj, data);
    this.recalculate();
    this.notify('project_updated', proj);
  }

  updateSimpleData(simpleData) {
    const proj = this.getActiveProject();
    if (!proj || proj.mode !== 'simple') return;
    proj.simpleData = { ...proj.simpleData, ...simpleData };
    this.recalculate();
  }

  updatePointElevation(pointId, zNat, zProj) {
    const proj = this.getActiveProject();
    if (!proj || proj.mode !== 'advanced') return;
    const pt = proj.points.find(p => p.id === pointId);
    if (pt) {
      if (zNat !== undefined && !isNaN(zNat)) pt.zNat = Number(Number(zNat).toFixed(3));
      if (zProj !== undefined && !isNaN(zProj)) pt.zProj = Number(Number(zProj).toFixed(3));
      this.recalculate();
    }
  }

  addScenario(name, offsetZ = 0) {
    const proj = this.getActiveProject();
    if (!proj) return;
    if (!proj.scenarios) proj.scenarios = [];
    const newSc = {
      id: 'sc_' + Date.now(),
      name: name || `Alternativa ${proj.scenarios.length + 1}`,
      offsetZ: Number(offsetZ) || 0
    };
    proj.scenarios.push(newSc);
    this.recalculate();
    this.notify('scenarios_updated', proj.scenarios);
  }

  deleteScenario(scId) {
    const proj = this.getActiveProject();
    if (!proj || !proj.scenarios) return;
    if (proj.scenarios.length <= 1) {
      alert("Debe mantenerse al menos un escenario de rasante.");
      return;
    }
    proj.scenarios = proj.scenarios.filter(s => s.id !== scId);
    if (this.activeScenarioId === scId) {
      this.activeScenarioId = proj.scenarios[0].id;
    }
    this.recalculate();
    this.notify('scenarios_updated', proj.scenarios);
  }

  createProject(newProjData) {
    const id = 'proj_' + Date.now();
    const newProj = {
      id,
      name: newProjData.name || "Nuevo Proyecto Topográfico",
      location: newProjData.location || "Córdoba, Argentina",
      description: newProjData.description || "Proyecto de cubicación y movimiento de suelos.",
      date: new Date().toISOString().split('T')[0],
      mode: newProjData.mode || 'advanced',
      bulkingFactor: Number(newProjData.bulkingFactor) || 15,
      shrinkageFactor: Number(newProjData.shrinkageFactor) || 10,
      unitCutCost: Number(newProjData.unitCutCost) || 4500,
      unitFillCost: Number(newProjData.unitFillCost) || 5200,
      grid: newProjData.grid || {
        rows: 10,
        cols: 10,
        dx: 5,
        dy: 5,
        terrainType: 'rolling',
        baseZ: 100
      },
      scenarios: [
        { id: "sc_base", name: "Rasante de Proyecto", offsetZ: 0, isBase: true },
        { id: "sc_opt", name: "Rasante Compensada Óptima", autoBalance: true }
      ]
    };

    if (newProj.mode === 'advanced') {
      newProj.points = EarthworkMath.generateSyntheticTerrain(
        newProj.grid.rows,
        newProj.grid.cols,
        newProj.grid.dx,
        newProj.grid.dy,
        newProj.grid.terrainType,
        newProj.grid.baseZ
      );
    } else {
      newProj.simpleData = {
        area: 2500,
        zNatural: 102.50,
        zProject: 101.80,
        bulkingFactor: 15,
        shrinkageFactor: 10
      };
    }

    this.projects.push(newProj);
    this.activeProjectId = id;
    this.activeScenarioId = 'sc_base';
    this.recalculate();
    this.notify('project_created', newProj);
  }

  duplicateProject(id) {
    const source = this.projects.find(p => p.id === id);
    if (!source) return;
    const cloned = JSON.parse(JSON.stringify(source));
    cloned.id = 'proj_' + Date.now();
    cloned.name = cloned.name + " (Copia)";
    cloned.date = new Date().toISOString().split('T')[0];
    this.projects.push(cloned);
    this.setActiveProject(cloned.id);
  }

  deleteProject(id) {
    if (this.projects.length <= 1) {
      alert("No es posible eliminar el único proyecto existente.");
      return;
    }
    this.projects = this.projects.filter(p => p.id !== id);
    if (this.activeProjectId === id) {
      this.activeProjectId = this.projects[0].id;
    }
    this.recalculate();
    this.notify('project_deleted', id);
  }

  importFromCSV(csvText) {
    const proj = this.getActiveProject();
    if (!proj || proj.mode !== 'advanced') {
      throw new Error("La importación de CSV solo está disponible en el Modo Avanzado.");
    }

    // Validar con EarthworkMath.validateCSVData
    const validation = EarthworkMath.validateCSVData(csvText);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true
    });

    const rows = parsed.data;
    const sample = rows[0];
    const xKey = validation.xKey || Object.keys(sample).find(k => /^x$/i.test(k.trim())) || 'x';
    const yKey = validation.yKey || Object.keys(sample).find(k => /^y$/i.test(k.trim())) || 'y';
    const zNatKey = validation.zNatKey || Object.keys(sample).find(k => /^(znat|z_nat|cota_natural|znatural|z)$/i.test(k.trim())) || 'zNat';
    const zProjKey = Object.keys(sample).find(k => /^(zproj|z_proj|cota_proyecto|zproyecto|rasante)$/i.test(k.trim())) || 'zProj';

    const xVals = [...new Set(rows.map(r => Number(r[xKey])))].sort((a, b) => a - b);
    const yVals = [...new Set(rows.map(r => Number(r[yKey])))].sort((a, b) => a - b);

    const dx = Number((xVals[1] - xVals[0]).toFixed(3)) || 5;
    const dy = Number((yVals[1] - yVals[0]).toFixed(3)) || 5;

    const newPoints = [];
    yVals.forEach((y, r) => {
      xVals.forEach((x, c) => {
        const found = rows.find(row => Math.abs(Number(row[xKey]) - x) < 0.01 && Math.abs(Number(row[yKey]) - y) < 0.01);
        const zNat = found ? Number(found[zNatKey]) : 100;
        const zProj = (found && found[zProjKey] !== undefined) ? Number(found[zProjKey]) : (zNat - 0.5);

        newPoints.push({
          id: `P-${r + 1}-${c + 1}`,
          row: r,
          col: c,
          x,
          y,
          zNat: Number(zNat.toFixed(3)),
          zProj: Number(zProj.toFixed(3))
        });
      });
    });

    proj.grid.rows = yVals.length;
    proj.grid.cols = xVals.length;
    proj.grid.dx = dx;
    proj.grid.dy = dy;
    proj.points = newPoints;

    this.recalculate();
    this.notify('csv_imported', { totalPoints: newPoints.length, rows: yVals.length, cols: xVals.length });
  }

  exportToJSON() {
    const proj = this.getActiveProject();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(proj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${proj.name.replace(/\s+/g, '_')}_topoterra.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  importFromJSON(jsonText) {
    const parsed = JSON.parse(jsonText);
    if (!parsed.name || !parsed.mode) {
      throw new Error("Archivo JSON no compatible con el formato de TopoTerra.");
    }
    parsed.id = 'proj_' + Date.now();
    if (parsed.mode === 'advanced' && (!parsed.points || parsed.points.length === 0)) {
      if (parsed.grid) {
        parsed.points = EarthworkMath.generateSyntheticTerrain(
          parsed.grid.rows,
          parsed.grid.cols,
          parsed.grid.dx,
          parsed.grid.dy,
          parsed.grid.terrainType || 'rolling',
          parsed.grid.baseZ || 100
        );
      }
    }
    this.projects.push(parsed);
    this.setActiveProject(parsed.id);
  }
}

// Singleton global
window.AppState = new AppStateManager();
