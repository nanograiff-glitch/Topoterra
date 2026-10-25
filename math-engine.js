/**
 * TopoTerra Civil Pro - Math Engine
 * Módulo de Cubicaciones de Movimiento de Suelos (Corte y Relleno)
 * Basado en métodos oficiales de Topografía y Geodesia - Ingeniería Civil UTN FRC
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EarthworkMath = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TOLERANCE = 0.005; // 5 mm de tolerancia para cota neutra / equilibrio

  /**
   * Cálculo en Modo Simple (Superficie Uniforme)
   * @param {Object} params - { area, zNatural, zProject, bulkingFactor, shrinkageFactor }
   * @returns {Object} Resultados de cubicación
   */
  function calculateSimple(params) {
    const area = Number(params.area) || 0;
    const zNatural = Number(params.zNatural) || 0;
    const zProject = Number(params.zProject) || 0;
    const bulkingFactor = Number(params.bulkingFactor) || 0; // % ej: 15
    const shrinkageFactor = Number(params.shrinkageFactor) || 0; // % ej: 10

    if (area <= 0) {
      throw new Error("El área debe ser un valor positivo mayor a 0 m².");
    }

    const deltaH = zNatural - zProject;
    let cutVolume = 0;
    let fillVolume = 0;
    let cutArea = 0;
    let fillArea = 0;
    let maxCut = 0;
    let avgCut = 0;
    let maxFill = 0;
    let avgFill = 0;
    let status = 'EQUILIBRIO';

    if (deltaH > TOLERANCE) {
      // Terreno natural por encima de la rasante -> CORTE (Desmonte)
      cutVolume = area * deltaH;
      cutArea = area;
      maxCut = deltaH;
      avgCut = deltaH;
      status = 'CORTE';
    } else if (deltaH < -TOLERANCE) {
      // Rasante por encima del terreno natural -> RELLENO (Terraplén)
      const absH = Math.abs(deltaH);
      fillVolume = area * absH;
      fillArea = area;
      maxFill = absH;
      avgFill = absH;
      status = 'RELLENO';
    } else {
      status = 'EQUILIBRIO';
    }

    const netBalance = cutVolume - fillVolume; // (+) Excedente, (-) Préstamo
    const totalVolume = cutVolume + fillVolume; // Movimiento bruto total

    // Factores de esponjamiento y compactación
    const expandedCutVolume = cutVolume * (1 + bulkingFactor / 100);
    const requiredFillVolume = fillVolume * (1 + shrinkageFactor / 100);

    return {
      mode: 'simple',
      area,
      zNatural,
      zProject,
      deltaH,
      status,
      cutVolume,
      fillVolume,
      netBalance,
      totalVolume,
      cutArea,
      fillArea,
      balancedArea: area - cutArea - fillArea,
      maxCut,
      avgCut,
      maxFill,
      avgFill,
      bulkingFactor,
      shrinkageFactor,
      expandedCutVolume,
      requiredFillVolume,
      truckLoads: Math.ceil(Math.max(expandedCutVolume, requiredFillVolume) / 15), // camiones de 15 m3
      assumptions: [
        "Terreno natural asumido como plano horizontal uniforme.",
        "Cota de rasante asumida horizontal y paralela al plano de referencia.",
        "No contempla taludes laterales de desmonte o terraplén.",
        "Estimación preliminar conceptual que no sustituye un relevamiento topográfico con malla de puntos."
      ]
    };
  }

  /**
   * Sub-integración de un triángulo topográfico con cotas delta en sus 3 vértices
   * Evita la cancelación mutua de corte y relleno en celdas mixtas
   * @param {number} areaT - Área del triángulo
   * @param {number} d1 - Delta h en vértice 1
   * @param {number} d2 - Delta h en vértice 2
   * @param {number} d3 - Delta h en vértice 3
   */
  function integrateTriangle(areaT, d1, d2, d3) {
    const EPS = 1e-6;
    const v = [d1, d2, d3];
    const pos = v.filter(d => d > EPS);
    const neg = v.filter(d => d < -EPS);

    // Caso 1: Todo el triángulo está en CORTE
    if (neg.length === 0) {
      const volCut = areaT * (d1 + d2 + d3) / 3;
      return { cutVol: Math.max(0, volCut), fillVol: 0, cutArea: areaT, fillArea: 0 };
    }

    // Caso 2: Todo el triángulo está en RELLENO
    if (pos.length === 0) {
      const volFill = areaT * (-d1 - d2 - d3) / 3;
      return { cutVol: 0, fillVol: Math.max(0, volFill), cutArea: 0, fillArea: areaT };
    }

    // Caso 3: Mixto (Línea de cota roja cero atraviesa el triángulo)
    if (pos.length === 1) {
      // 1 vértice positivo, 2 vértices negativos
      const p = v.find(d => d > EPS);
      const n = v.filter(d => d <= EPS);
      const t1 = p / (p - n[0]);
      const t2 = p / (p - n[1]);
      const aCut = areaT * t1 * t2;
      const vCut = (1 / 3) * aCut * p;
      const aFill = Math.max(0, areaT - aCut);
      const netTotal = areaT * (d1 + d2 + d3) / 3;
      const vFill = Math.max(0, vCut - netTotal);
      return { cutVol: vCut, fillVol: vFill, cutArea: aCut, fillArea: aFill };
    } else {
      // 2 vértices positivos, 1 vértice negativo
      const n = v.find(d => d < -EPS);
      const p = v.filter(d => d >= -EPS);
      const t1 = (-n) / (-n + p[0]);
      const t2 = (-n) / (-n + p[1]);
      const aFill = areaT * t1 * t2;
      const vFill = (1 / 3) * aFill * (-n);
      const aCut = Math.max(0, areaT - aFill);
      const netTotal = areaT * (d1 + d2 + d3) / 3;
      const vCut = Math.max(0, vFill + netTotal);
      return { cutVol: vCut, fillVol: vFill, cutArea: aCut, fillArea: aFill };
    }
  }

  /**
   * Cálculo en Modo Avanzado (Malla regular de puntos y cuadrícula de prismas)
   * @param {Object} gridData - { rows, cols, dx, dy, points }
   * @param {Object} options - { bulkingFactor, shrinkageFactor }
   */
  function calculateAdvanced(gridData, options = {}) {
    const rows = gridData.rows;
    const cols = gridData.cols;
    const dx = Number(gridData.dx) || 5;
    const dy = Number(gridData.dy) || 5;
    const points = gridData.points; // Array de objetos { x, y, row, col, zNat, zProj }
    const bulkingFactor = Number(options.bulkingFactor) || 0;
    const shrinkageFactor = Number(options.shrinkageFactor) || 0;

    if (!points || points.length === 0) {
      throw new Error("No hay puntos topográficos para realizar la cubicación.");
    }

    if (rows < 2 || cols < 2) {
      throw new Error("La cuadrícula requiere al menos 2 filas y 2 columnas de puntos.");
    }

    const cellArea = dx * dy;
    const halfCellArea = cellArea / 2;
    const totalSurfaceArea = (cols - 1) * dx * (rows - 1) * dy;

    // Matriz de acceso rápido
    const gridMatrix = [];
    for (let r = 0; r < rows; r++) {
      gridMatrix[r] = [];
    }

    let minZNat = Infinity;
    let maxZNat = -Infinity;
    let minZProj = Infinity;
    let maxZProj = -Infinity;
    let sumDeltaH = 0;
    let maxCutDepth = 0;
    let maxFillHeight = 0;

    points.forEach(pt => {
      const zNat = Number(pt.zNat);
      const zProj = Number(pt.zProj);
      const deltaH = zNat - zProj;

      minZNat = Math.min(minZNat, zNat);
      maxZNat = Math.max(maxZNat, zNat);
      minZProj = Math.min(minZProj, zProj);
      maxZProj = Math.max(maxZProj, zProj);
      sumDeltaH += deltaH;

      if (deltaH > maxCutDepth) maxCutDepth = deltaH;
      if (deltaH < -maxFillHeight) maxFillHeight = -deltaH;

      gridMatrix[pt.row][pt.col] = {
        ...pt,
        zNat,
        zProj,
        deltaH,
        status: deltaH > TOLERANCE ? 'CORTE' : (deltaH < -TOLERANCE ? 'RELLENO' : 'EQUILIBRIO')
      };
    });

    let totalCutVol = 0;
    let totalFillVol = 0;
    let totalCutArea = 0;
    let totalFillArea = 0;
    const cells = [];

    // Iterar sobre cada celda cuadrilátera de la malla
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const p1 = gridMatrix[r][c];
        const p2 = gridMatrix[r][c + 1];
        const p3 = gridMatrix[r + 1][c + 1];
        const p4 = gridMatrix[r + 1][c];

        if (!p1 || !p2 || !p3 || !p4) continue;

        // Triangulación 1: (p1, p2, p3)
        const t1Res = integrateTriangle(halfCellArea, p1.deltaH, p2.deltaH, p3.deltaH);
        // Triangulación 2: (p1, p3, p4)
        const t2Res = integrateTriangle(halfCellArea, p1.deltaH, p3.deltaH, p4.deltaH);

        const cellCutVol = t1Res.cutVol + t2Res.cutVol;
        const cellFillVol = t1Res.fillVol + t2Res.fillVol;
        const cellCutArea = t1Res.cutArea + t2Res.cutArea;
        const cellFillArea = t1Res.fillArea + t2Res.fillArea;
        const meanDelta = (p1.deltaH + p2.deltaH + p3.deltaH + p4.deltaH) / 4;

        totalCutVol += cellCutVol;
        totalFillVol += cellFillVol;
        totalCutArea += cellCutArea;
        totalFillArea += cellFillArea;

        let cellType = 'EQUILIBRIO';
        if (cellCutVol > 0.001 && cellFillVol > 0.001) {
          cellType = 'MIXTO';
        } else if (cellCutVol > 0.001) {
          cellType = 'CORTE';
        } else if (cellFillVol > 0.001) {
          cellType = 'RELLENO';
        }

        cells.push({
          row: r,
          col: c,
          centerX: (p1.x + p3.x) / 2,
          centerY: (p1.y + p3.y) / 2,
          meanDelta,
          cellCutVol,
          cellFillVol,
          cellCutArea,
          cellFillArea,
          cellType
        });
      }
    }

    const netBalance = totalCutVol - totalFillVol;
    const totalVolume = totalCutVol + totalFillVol;
    const avgDeltaH = sumDeltaH / points.length;

    // Medias ponderadas de profundidades
    const avgCutDepth = totalCutArea > 0 ? (totalCutVol / totalCutArea) : 0;
    const avgFillHeight = totalFillArea > 0 ? (totalFillVol / totalFillArea) : 0;
    const balancedArea = Math.max(0, totalSurfaceArea - totalCutArea - totalFillArea);

    const expandedCutVolume = totalCutVol * (1 + bulkingFactor / 100);
    const requiredFillVolume = totalFillVol * (1 + shrinkageFactor / 100);

    return {
      mode: 'advanced',
      rows,
      cols,
      dx,
      dy,
      cellArea,
      totalCells: (rows - 1) * (cols - 1),
      totalPoints: points.length,
      surfaceArea: totalSurfaceArea,
      surfaceHectares: totalSurfaceArea / 10000,
      minZNat,
      maxZNat,
      minZProj,
      maxZProj,
      maxCutDepth,
      maxFillHeight,
      avgCutDepth,
      avgFillHeight,
      avgDeltaH,
      cutVolume: totalCutVol,
      fillVolume: totalFillVol,
      netBalance,
      totalVolume,
      cutArea: totalCutArea,
      fillArea: totalFillArea,
      balancedArea,
      bulkingFactor,
      shrinkageFactor,
      expandedCutVolume,
      requiredFillVolume,
      truckLoads: Math.ceil(Math.max(expandedCutVolume, requiredFillVolume) / 15),
      cells,
      gridMatrix,
      assumptions: [
        `Cuadrícula regular de ${cols}x${rows} puntos topográficos con paso dx=${dx}m y dy=${dy}m.`,
        "Método de integración de prismas triangulares con interpolación de línea de cota cero (TIN sub-cell).",
        "Garantiza conservación de volúmenes sin cancelación artificial en zonas de corte y relleno concurrentes.",
        "Apto para modelado digital de elevaciones (MDE/MDS) y proyectos viales, urbanos y mineros."
      ]
    };
  }

  /**
   * Encuentra la cota de rasante uniforme óptima que equilibra el volumen de corte con el de relleno
   * (Minimiza el desbalance neto de tierras: V_corte ≈ V_relleno)
   * @param {Object} gridData 
   * @returns {number} Cota óptima Z en metros
   */
  function findBalancedGradeElevation(gridData) {
    let low = Infinity;
    let high = -Infinity;

    gridData.points.forEach(p => {
      if (p.zNat < low) low = p.zNat;
      if (p.zNat > high) high = p.zNat;
    });

    if (!isFinite(low) || !isFinite(high) || low >= high) {
      return 100.0;
    }

    // Bisección para hallar f(z) = NetBalance(z) = 0
    let bestZ = (low + high) / 2;
    for (let iter = 0; iter < 18; iter++) {
      const mid = (low + high) / 2;
      const testPoints = gridData.points.map(p => ({
        ...p,
        zProj: mid
      }));
      const testGrid = { ...gridData, points: testPoints };
      const res = calculateAdvanced(testGrid);

      if (Math.abs(res.netBalance) < 0.1) {
        bestZ = mid;
        break;
      }
      if (res.netBalance > 0) {
        // Mucho corte -> hay que subir la rasante para que haya menos corte y más relleno
        low = mid;
      } else {
        // Mucho relleno -> hay que bajar la rasante
        high = mid;
      }
      bestZ = mid;
    }

    return Number(bestZ.toFixed(2));
  }

  /**
   * Genera un terreno sintético realista para demostración técnica
   * @param {number} rows 
   * @param {number} cols 
   * @param {number} dx 
   * @param {number} dy 
   * @param {string} terrainType - 'rolling' | 'slope' | 'basin'
   * @param {number} baseZ 
   * @returns {Array} Puntos topográficos
   */
  function generateSyntheticTerrain(rows = 11, cols = 11, dx = 5, dy = 5, terrainType = 'rolling', baseZ = 100) {
    const points = [];
    const width = (cols - 1) * dx;
    const height = (rows - 1) * dy;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * dx;
        const y = r * dy;
        const u = x / (width || 1);
        const v = y / (height || 1);

        let zNat = baseZ;
        let zProj = baseZ + 0.5; // rasante por defecto

        if (terrainType === 'rolling') {
          // Relieve ondulado serrano realista (loma al suroeste, vaguada al noreste)
          const hill = Math.sin(u * Math.PI * 1.5) * 1.8 + Math.cos(v * Math.PI) * 1.2;
          const micro = Math.sin(u * 5 + v * 3) * 0.35;
          zNat = baseZ + hill + micro;
          // Rasante inclinada con pendiente longitudinal del 1.5% para drenaje pluvial
          zProj = baseZ + 0.8 + (u - 0.5) * 1.2 - (v - 0.5) * 0.5;
        } else if (terrainType === 'slope') {
          // Pendiente natural pronunciada con plataforma horizontal proyectada
          zNat = baseZ + (u * 3.5) + (v * 1.2) + Math.sin(u * 4) * 0.4;
          zProj = baseZ + 2.0; // Plataforma plana a cota 102.00
        } else if (terrainType === 'basin') {
          // Depresión / Bajo natural con relleno necesario
          const distFromCenter = Math.hypot(u - 0.5, v - 0.5) * 2;
          zNat = baseZ - (1 - Math.min(1, distFromCenter)) * 2.5 + Math.sin(u * 6) * 0.2;
          zProj = baseZ - 0.3;
        }

        points.push({
          id: `P-${r + 1}-${c + 1}`,
          row: r,
          col: c,
          x,
          y,
          zNat: Number(zNat.toFixed(3)),
          zProj: Number(zProj.toFixed(3))
        });
      }
    }

    return points;
  }

  /**
   * Validador de estructura y datos de archivo CSV topográfico
   * @param {string} csvText
   * @returns {Object} { valid: boolean, error?: string, totalPoints?: number, rows?: number, cols?: number, data?: Array }
   */
  function validateCSVData(csvText) {
    if (!csvText || typeof csvText !== 'string' || !csvText.trim()) {
      return { valid: false, error: "El archivo o contenido CSV está vacío." };
    }

    let rows = [];
    if (typeof Papa !== 'undefined') {
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true, dynamicTyping: true });
      if (parsed.errors && parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
        return { valid: false, error: "Error de formato CSV: " + parsed.errors[0].message };
      }
      rows = parsed.data || [];
    } else {
      const lines = csvText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) return { valid: false, error: "El archivo CSV no contiene suficientes líneas." };
      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        const row = {};
        headers.forEach((h, idx) => {
          const val = Number(parts[idx]);
          row[h] = isNaN(val) ? parts[idx] : val;
        });
        rows.push(row);
      }
    }

    if (!rows || rows.length < 4) {
      return { valid: false, error: "El archivo CSV debe contener al menos 4 puntos para formar una cuadrícula." };
    }

    const sample = rows[0];
    const keys = Object.keys(sample).map(k => k.trim());
    const xKey = keys.find(k => /^x$/i.test(k));
    const yKey = keys.find(k => /^y$/i.test(k));
    const zNatKey = keys.find(k => /^(znat|z_nat|cota_natural|znatural|z)$/i.test(k));

    if (!xKey || !yKey || !zNatKey) {
      return { valid: false, error: "El CSV debe contener columnas X, Y y Cota Natural (Z_Natural o Znat)." };
    }

    // Verificar que todas las filas tengan números válidos
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const xVal = Number(r[xKey]);
      const yVal = Number(r[yKey]);
      const zVal = Number(r[zNatKey]);
      if (isNaN(xVal) || isNaN(yVal) || isNaN(zVal)) {
        return { valid: false, error: `Fila ${i + 1}: Datos no numéricos detectados en coordenadas o cotas.` };
      }
    }

    const xVals = [...new Set(rows.map(r => Number(r[xKey])))].sort((a, b) => a - b);
    const yVals = [...new Set(rows.map(r => Number(r[yKey])))].sort((a, b) => a - b);

    if (xVals.length < 2 || yVals.length < 2) {
      return { valid: false, error: "Las coordenadas deben definir al menos una malla de 2x2 puntos distintos." };
    }

    return {
      valid: true,
      error: null,
      totalPoints: rows.length,
      rows: yVals.length,
      cols: xVals.length,
      xKey,
      yKey,
      zNatKey
    };
  }

  /**
   * Suite de pruebas unitarias para verificación matemática y dimensional
   * Evalúa las funciones de cubicación y validación conforme al pliego:
   * 1. Terreno plano uniforme (Caso nulo: 0 m³ corte, 0 m³ relleno)
   * 2. Corte uniforme (100 m² x 2 m = 200 m³ corte, 0 m³ relleno)
   * 3. Relleno uniforme (100 m² x 1 m = 100 m³ relleno, 0 m³ corte)
   * 4. Validador de importación CSV con datos erróneos
   * 5. Caso mixto en cuadrícula (Subdivisión TIN sin cancelación artificial)
   * 6. Detección y rechazo de dimensiones geométricas inválidas
   */
  function runUnitTests() {
    const results = [];

    // Test 1: Terreno plano uniforme (Caso nulo: 0 m³ corte, 0 m³ relleno)
    try {
      const res = calculateSimple({ area: 100, zNatural: 100.0, zProject: 100.0 });
      const pass = res.cutVolume === 0 && res.fillVolume === 0 && res.status === 'EQUILIBRIO';
      results.push({
        name: "1. Terreno plano uniforme (Caso nulo)",
        pass,
        details: `Área=100 m², Znat=100.0m, Zproj=100.0m -> Corte=${res.cutVolume} m³, Relleno=${res.fillVolume} m³ [${res.status}]`
      });
    } catch (e) {
      results.push({ name: "1. Terreno plano uniforme (Caso nulo)", pass: false, details: e.message });
    }

    // Test 2: Corte uniforme (100 m² x 2 m = 200 m³ corte, 0 m³ relleno)
    try {
      const res = calculateSimple({ area: 100, zNatural: 102.0, zProject: 100.0 });
      const expectedCut = 200; // 100 * 2 = 200 m3
      const pass = Math.abs(res.cutVolume - expectedCut) < 1e-4 && res.fillVolume === 0 && res.status === 'CORTE';
      results.push({
        name: "2. Corte uniforme (100 m² x 2 m = 200 m³)",
        pass,
        details: `Esperado: Corte=200.0 m³, Relleno=0.0 m³ -> Calculado: Corte=${res.cutVolume.toFixed(1)} m³, Relleno=${res.fillVolume.toFixed(1)} m³`
      });
    } catch (e) {
      results.push({ name: "2. Corte uniforme", pass: false, details: e.message });
    }

    // Test 3: Relleno uniforme (100 m² x 1 m = 100 m³ relleno, 0 m³ corte)
    try {
      const res = calculateSimple({ area: 100, zNatural: 99.0, zProject: 100.0 });
      const expectedFill = 100; // 100 * 1 = 100 m3
      const pass = Math.abs(res.fillVolume - expectedFill) < 1e-4 && res.cutVolume === 0 && res.status === 'RELLENO';
      results.push({
        name: "3. Relleno uniforme (100 m² x 1 m = 100 m³)",
        pass,
        details: `Esperado: Corte=0.0 m³, Relleno=100.0 m³ -> Calculado: Corte=${res.cutVolume.toFixed(1)} m³, Relleno=${res.fillVolume.toFixed(1)} m³`
      });
    } catch (e) {
      results.push({ name: "3. Relleno uniforme", pass: false, details: e.message });
    }

    // Test 4: Validador de importación CSV con datos erróneos
    try {
      const invalidCsv1 = "columna_invalida_1,columna_2\n10,20\n30,40";
      const invalidCsv2 = "X,Y,Z_Natural\n0,0,texto_no_numero\n5,0,100";
      const validCsv = "X,Y,Z_Natural,Z_Proyecto\n0,0,102.0,100.0\n5,0,102.0,100.0\n0,5,102.0,100.0\n5,5,102.0,100.0";

      const check1 = validateCSVData(invalidCsv1);
      const check2 = validateCSVData(invalidCsv2);
      const check3 = validateCSVData(validCsv);

      const pass = !check1.valid && !check2.valid && check3.valid;
      results.push({
        name: "4. Validador de importación CSV con datos erróneos",
        pass,
        details: pass
          ? "Rechazó correctamente columnas faltantes y datos alfanuméricos no válidos; aprobó CSV sintáctico 2x2."
          : `Falló detección: check1=${check1.valid}, check2=${check2.valid}, check3=${check3.valid}`
      });
    } catch (e) {
      results.push({ name: "4. Validador de importación CSV con datos erróneos", pass: false, details: e.message });
    }

    // Test 5: Caso mixto en cuadrícula (Subdivisión TIN sin cancelación artificial)
    try {
      const pts = [
        { row: 0, col: 0, x: 0, y: 0, zNat: 102, zProj: 100 }, // +2 (Corte)
        { row: 0, col: 1, x: 10, y: 0, zNat: 102, zProj: 100 }, // +2 (Corte)
        { row: 1, col: 0, x: 0, y: 10, zNat: 98, zProj: 100 },  // -2 (Relleno)
        { row: 1, col: 1, x: 10, y: 10, zNat: 98, zProj: 100 }   // -2 (Relleno)
      ];
      const grid = { rows: 2, cols: 2, dx: 10, dy: 10, points: pts };
      const res = calculateAdvanced(grid);
      const pass = res.cutVolume > 40 && res.fillVolume > 40 && Math.abs(res.netBalance) < 1e-2;
      results.push({
        name: "5. Caso mixto en celda (Subdivisión TIN)",
        pass,
        details: `Corte=${res.cutVolume.toFixed(2)} m³, Relleno=${res.fillVolume.toFixed(2)} m³, Balance Neto=${res.netBalance.toFixed(2)} m³`
      });
    } catch (e) {
      results.push({ name: "5. Caso mixto en celda", pass: false, details: e.message });
    }

    // Test 6: Detección y rechazo de dimensiones geométricas inválidas
    try {
      let threwError = false;
      try {
        calculateSimple({ area: -50, zNatural: 100, zProject: 100 });
      } catch (err) {
        threwError = true;
      }
      results.push({
        name: "6. Detección de datos geométricos inválidos (Área negativa)",
        pass: threwError,
        details: threwError ? "Validación interceptó y bloqueó correctamente área negativa." : "Falló validación de área."
      });
    } catch (e) {
      results.push({ name: "6. Detección de datos inválidos", pass: false, details: e.message });
    }

    return results;
  }

  return {
    TOLERANCE,
    calculateSimple,
    calculateAdvanced,
    findBalancedGradeElevation,
    generateSyntheticTerrain,
    validateCSVData,
    runUnitTests
  };
}));
