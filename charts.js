/**
 * TopoTerra Civil Pro - Charts & Analytics Module
 * Gráficos interactivos de perfiles longitudinales/transversales,
 * histogramas altimétricos, distribución de áreas y comparativa de escenarios con Chart.js.
 */

class DashboardCharts {
  constructor() {
    this.profileLongChart = null;
    this.profileTransChart = null;
    this.summaryDoughnut = null;
    this.histogramChart = null;
    this.scenariosChart = null;

    this.initChartDefaults();
  }

  initChartDefaults() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
    Chart.defaults.color = AppState.theme === 'dark' ? '#94a3b8' : '#64748b';
    Chart.defaults.borderColor = AppState.theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  }

  updateAll() {
    this.initChartDefaults();
    this.renderSummaryDoughnut();
    this.renderLongitudinalProfile();
    this.renderTransversalProfile();
    this.renderHistogram();
    this.renderScenariosComparison();
  }

  renderSummaryDoughnut() {
    const canvas = document.getElementById('chart-volume-doughnut');
    if (!canvas || !AppState.currentResults) return;

    const res = AppState.currentResults;
    const cut = Number(res.cutVolume.toFixed(1));
    const fill = Number(res.fillVolume.toFixed(1));

    if (this.summaryDoughnut) this.summaryDoughnut.destroy();

    this.summaryDoughnut = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Corte (Desmonte)', 'Relleno (Terraplén)'],
        datasets: [{
          data: [cut, fill],
          backgroundColor: ['#ef4444', '#3b82f6'],
          hoverBackgroundColor: ['#dc2626', '#2563eb'],
          borderWidth: 2,
          borderColor: AppState.theme === 'dark' ? '#0f172a' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, padding: 15 }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const val = context.raw || 0;
                const total = cut + fill;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                return ` ${context.label}: ${val.toLocaleString('es-AR')} m³ (${pct}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  renderLongitudinalProfile(rowIndex = null) {
    const canvas = document.getElementById('chart-profile-long');
    if (!canvas || !AppState.currentResults) return;

    const proj = AppState.getActiveProject();
    if (this.profileLongChart) {
      this.profileLongChart.destroy();
      this.profileLongChart = null;
    }

    if (proj.mode === 'simple') {
      const L = Math.round(Math.sqrt(proj.simpleData.area || 1000));
      this.profileLongChart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: ['0m', `${Math.round(L / 2)}m`, `${L}m`],
          datasets: [
            {
              label: 'Terreno Natural (Znat)',
              data: [proj.simpleData.zNatural, proj.simpleData.zNatural, proj.simpleData.zNatural],
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderWidth: 2.5,
              fill: false
            },
            {
              label: 'Rasante Proyectada (Zproj)',
              data: [proj.simpleData.zProject, proj.simpleData.zProject, proj.simpleData.zProject],
              borderColor: '#0284c7',
              borderDash: [5, 5],
              borderWidth: 2,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: 'Perfil Uniforme - Cota Natural vs Rasante' }
          }
        }
      });
      return;
    }

    const gridData = AppState.getEffectiveGridData();
    if (!gridData || !AppState.currentResults.gridMatrix) return;

    const matrix = AppState.currentResults.gridMatrix;
    const r = rowIndex !== null ? rowIndex : (AppState.selectedProfile && AppState.selectedProfile.type === 'longitudinal' ? AppState.selectedProfile.index : Math.floor(gridData.rows / 2));
    const safeRow = Math.min(gridData.rows - 1, Math.max(0, r));

    const labels = [];
    const zNatData = [];
    const zProjData = [];
    const deltaData = [];

    for (let c = 0; c < gridData.cols; c++) {
      const pt = matrix[safeRow][c];
      if (!pt) continue;
      labels.push(`${pt.x.toFixed(0)}m`);
      zNatData.push(pt.zNat);
      zProjData.push(pt.zProj);
      deltaData.push(pt.deltaH);
    }

    this.profileLongChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Terreno Natural (Znat)',
            data: zNatData,
            borderColor: '#10b981', // Verde topográfico
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: false,
            tension: 0.3,
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Rasante Proyectada (Zproj)',
            data: zProjData,
            borderColor: '#0284c7', // Azul rasante
            borderDash: [5, 5],
            fill: false,
            tension: 0.1,
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top' },
          title: {
            display: true,
            text: `Perfil Longitudinal en Y = ${(safeRow * gridData.dy).toFixed(1)} m (Fila ${safeRow + 1})`
          },
          tooltip: {
            callbacks: {
              afterBody: (items) => {
                const idx = items[0].dataIndex;
                const diff = deltaData[idx];
                const sign = diff >= 0 ? '+' : '';
                const type = diff > 0.02 ? 'CORTE' : (diff < -0.02 ? 'RELLENO' : 'EQUILIBRIO');
                return `Cota Roja (Δh): ${sign}${diff.toFixed(2)} m [${type}]`;
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Progresiva Longitudinal X (metros)' }
          },
          y: {
            title: { display: true, text: 'Cota Altimétrica (m s.n.m.)' }
          }
        }
      }
    });
  }

  renderTransversalProfile(colIndex = null) {
    const canvas = document.getElementById('chart-profile-trans');
    if (!canvas || !AppState.currentResults) return;

    const proj = AppState.getActiveProject();
    if (this.profileTransChart) {
      this.profileTransChart.destroy();
      this.profileTransChart = null;
    }

    if (proj.mode === 'simple') {
      const W = Math.round(Math.sqrt(proj.simpleData.area || 1000));
      this.profileTransChart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: ['0m', `${Math.round(W / 2)}m`, `${W}m`],
          datasets: [
            {
              label: 'Terreno Natural (Znat)',
              data: [proj.simpleData.zNatural, proj.simpleData.zNatural, proj.simpleData.zNatural],
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              borderWidth: 2.5,
              fill: false
            },
            {
              label: 'Rasante Proyectada (Zproj)',
              data: [proj.simpleData.zProject, proj.simpleData.zProject, proj.simpleData.zProject],
              borderColor: '#6366f1',
              borderDash: [5, 5],
              borderWidth: 2,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: 'Sección Transversal - Cota Natural vs Rasante' }
          }
        }
      });
      return;
    }

    const gridData = AppState.getEffectiveGridData();
    if (!gridData || !AppState.currentResults.gridMatrix) return;

    const matrix = AppState.currentResults.gridMatrix;
    const c = colIndex !== null ? colIndex : (AppState.selectedProfile && AppState.selectedProfile.type === 'transverse' ? AppState.selectedProfile.index : Math.floor(gridData.cols / 2));
    const safeCol = Math.min(gridData.cols - 1, Math.max(0, c));

    const labels = [];
    const zNatData = [];
    const zProjData = [];
    const deltaData = [];

    for (let r = 0; r < gridData.rows; r++) {
      const pt = matrix[r][safeCol];
      if (!pt) continue;
      labels.push(`${pt.y.toFixed(0)}m`);
      zNatData.push(pt.zNat);
      zProjData.push(pt.zProj);
      deltaData.push(pt.deltaH);
    }

    this.profileTransChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Terreno Natural (Znat)',
            data: zNatData,
            borderColor: '#f59e0b', // Ambar
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            fill: false,
            tension: 0.3,
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Rasante Proyectada (Zproj)',
            data: zProjData,
            borderColor: '#6366f1', // Indigo
            borderDash: [5, 5],
            fill: false,
            tension: 0.1,
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top' },
          title: {
            display: true,
            text: `Sección Transversal en X = ${(safeCol * gridData.dx).toFixed(1)} m (Columna ${safeCol + 1})`
          },
          tooltip: {
            callbacks: {
              afterBody: (items) => {
                const idx = items[0].dataIndex;
                const diff = deltaData[idx];
                const sign = diff >= 0 ? '+' : '';
                const type = diff > 0.02 ? 'CORTE' : (diff < -0.02 ? 'RELLENO' : 'EQUILIBRIO');
                return `Cota Roja (Δh): ${sign}${diff.toFixed(2)} m [${type}]`;
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Distancia Transversal Y (metros)' }
          },
          y: {
            title: { display: true, text: 'Cota Altimétrica (m s.n.m.)' }
          }
        }
      }
    });
  }

  renderHistogram() {
    const canvas = document.getElementById('chart-histogram');
    if (!canvas || !AppState.currentResults) return;

    const gridData = AppState.getEffectiveGridData();
    if (!gridData || AppState.getActiveProject().mode === 'simple') return;

    // Clasificar puntos en rangos de profundidad/altura
    const bins = [
      { label: '< -1.5m (Relleno Alto)', min: -Infinity, max: -1.5, count: 0, color: '#1d4ed8' },
      { label: '-1.5 a -0.5m (Relleno Med)', min: -1.5, max: -0.5, count: 0, color: '#3b82f6' },
      { label: '-0.5 a -0.1m (Relleno Bajo)', min: -0.5, max: -0.1, count: 0, color: '#93c5fd' },
      { label: '± 0.1m (Equilibrio)', min: -0.1, max: 0.1, count: 0, color: '#10b981' },
      { label: '+0.1 a +0.5m (Corte Bajo)', min: 0.1, max: 0.5, count: 0, color: '#fca5a5' },
      { label: '+0.5 a +1.5m (Corte Med)', min: 0.5, max: 1.5, count: 0, color: '#ef4444' },
      { label: '> +1.5m (Corte Alto)', min: 1.5, max: Infinity, count: 0, color: '#b91c1c' }
    ];

    gridData.points.forEach(p => {
      const delta = p.zNat - p.zProj;
      for (const bin of bins) {
        if (delta > bin.min && delta <= bin.max) {
          bin.count++;
          break;
        }
      }
    });

    if (this.histogramChart) this.histogramChart.destroy();

    this.histogramChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: bins.map(b => b.label),
        datasets: [{
          label: 'Frecuencia de Puntos Topográficos',
          data: bins.map(b => b.count),
          backgroundColor: bins.map(b => b.color),
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Distribución de Frecuencia de Diferencias Altimétricas (Δh)' }
        },
        scales: {
          x: { ticks: { font: { size: 10 } } },
          y: {
            title: { display: true, text: 'Cantidad de Puntos' },
            beginAtZero: true
          }
        }
      }
    });
  }

  renderScenariosComparison() {
    const canvas = document.getElementById('chart-scenarios-comp');
    if (!canvas || !AppState.scenarioResults || AppState.scenarioResults.length === 0) return;

    const labels = AppState.scenarioResults.map(s => s.scenario.name);
    const cutData = AppState.scenarioResults.map(s => Number(s.results.cutVolume.toFixed(1)));
    const fillData = AppState.scenarioResults.map(s => Number(s.results.fillVolume.toFixed(1)));
    const netData = AppState.scenarioResults.map(s => Number(s.results.netBalance.toFixed(1)));

    if (this.scenariosChart) this.scenariosChart.destroy();

    this.scenariosChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Volumen Corte (m³)',
            data: cutData,
            backgroundColor: '#ef4444',
            borderRadius: 4
          },
          {
            label: 'Volumen Relleno (m³)',
            data: fillData,
            backgroundColor: '#3b82f6',
            borderRadius: 4
          },
          {
            label: 'Balance Neto (m³)',
            data: netData,
            backgroundColor: '#10b981',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Comparativa de Volúmenes por Alternativa de Rasante' }
        },
        scales: {
          y: {
            title: { display: true, text: 'Volumen en Metros Cúbicos (m³)' }
          }
        }
      }
    });
  }
}

window.DashboardCharts = DashboardCharts;
