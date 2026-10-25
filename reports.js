/**
 * TopoTerra Civil Pro - Reports & Exports Generator
 * Generador de Memoria Técnica de Cálculo Oficial, Exportación a PDF/Impresión,
 * Generación de CSV topográfico y archivo CAD DXF 3D.
 */

class ReportExporter {
  /**
   * Genera el HTML de la Memoria Técnica de Cálculo Oficial de Movimiento de Suelos
   */
  static generateTechnicalReportHTML() {
    const proj = AppState.getActiveProject();
    const res = AppState.currentResults;
    if (!proj || !res) return "<p>No hay datos de cálculo disponibles.</p>";

    const dateStr = new Date().toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const isAdvanced = proj.mode === 'advanced';
    const netSign = res.netBalance >= 0 ? '+' : '';
    const netDiagnosis = res.netBalance > 5 ? 'Excedente de material (desmonte neto hacia acopio o vertedero)' :
      (res.netBalance < -5 ? 'Déficit de material (necesidad de préstamo externo de terraplén)' : 'Compensado / Equilibrio casi neutro');

    const signConvCut = isAdvanced ?
      `V_{corte} = \\sum_{k=1}^N A_{k,cut} \\cdot \\bar{h}_{k,cut}` :
      `V_{corte} = A \\cdot \\max(z_{nat} - z_{proj}, 0)`;
    const signConvFill = isAdvanced ?
      `V_{relleno} = \\sum_{k=1}^N A_{k,fill} \\cdot \\bar{h}_{k,fill}` :
      `V_{relleno} = A \\cdot \\max(z_{proj} - z_{nat}, 0)`;

    let scenariosRows = '';
    if (AppState.scenarioResults && AppState.scenarioResults.length > 0) {
      scenariosRows = AppState.scenarioResults.map((sc, idx) => {
        const diffNet = sc.results.netBalance;
        const sign = diffNet >= 0 ? '+' : '';
        return `
          <tr>
            <td style="font-weight: 600;">${sc.scenario.name}</td>
            <td style="text-align: right;">${sc.results.cutVolume.toLocaleString('es-AR', { maximumFractionDigits: 1 })} m³</td>
            <td style="text-align: right;">${sc.results.fillVolume.toLocaleString('es-AR', { maximumFractionDigits: 1 })} m³</td>
            <td style="text-align: right; font-weight: 600; color: ${diffNet >= 0 ? '#ef4444' : '#3b82f6'};">${sign}${diffNet.toLocaleString('es-AR', { maximumFractionDigits: 1 })} m³</td>
            <td style="text-align: right;">${sc.results.totalVolume.toLocaleString('es-AR', { maximumFractionDigits: 1 })} m³</td>
            <td style="text-align: right;">$ ${sc.cost.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td>
          </tr>
        `;
      }).join('');
    }

    return `
      <div class="technical-report-document" id="printable-report">
        <!-- Encabezado Institucional -->
        <div class="report-header">
          <div class="report-header-logos">
            <div class="utn-brand">
              <h2>UNIVERSIDAD TECNOLÓGICA NACIONAL</h2>
              <h3>FACULTAD REGIONAL CÓRDOBA — DEPARTAMENTO DE INGENIERÍA CIVIL</h3>
              <p><strong>Cátedra:</strong> Fundamentos de Informática | <strong>Comisión:</strong> 1C2 | <strong>Ciclo Lectivo:</strong> 2026</p>
              <p><strong>Descriptor CONFEDI:</strong> Topografía y Geodesia — Competencia 1.2 Libro Rojo</p>
            </div>
            <div class="academic-badge">
              <span class="badge-title">TFI 2026</span>
              <span class="badge-sub">CIVIL STUDIO</span>
            </div>
          </div>
          <div class="report-title-banner">
            <h1>MEMORIA TÉCNICA DE CÁLCULO ALTIMÉTRICO Y MOVIMIENTO DE SUELOS</h1>
            <p class="subtitle">Determinación de Volúmenes de Desmonte, Terraplén y Balance de Masas</p>
          </div>
        </div>

        <!-- Metadatos del Proyecto -->
        <div class="report-section">
          <h4 class="section-title">1. DATOS GENERALES DEL PROYECTO</h4>
          <table class="report-table-meta">
            <tr>
              <td><strong>Nombre del Proyecto:</strong> ${proj.name}</td>
              <td><strong>Fecha de Emisión:</strong> ${dateStr}</td>
            </tr>
            <tr>
              <td><strong>Ubicación Geográfica:</strong> ${proj.location || 'Córdoba, Argentina'}</td>
              <td><strong>Metodología de Cálculo:</strong> ${isAdvanced ? 'Malla Regular de Puntos (Prismas Triangulares Sub-TIN)' : 'Estimación Preliminar Uniforme'}</td>
            </tr>
            <tr>
              <td colspan="2"><strong>Descripción del Emprendimiento:</strong> ${proj.description || 'Sin descripción adicional.'}</td>
            </tr>
          </table>
        </div>

        <!-- Parámetros Técnicos y Geotécnicos -->
        <div class="report-section">
          <h4 class="section-title">2. PARÁMETROS GEOTÉCNICOS Y CRITERIOS DE CÁLCULO</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th>Parámetro Topográfico / Geotécnico</th>
                <th>Valor Aplicado</th>
                <th>Unidad</th>
                <th>Observaciones Técnicas</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Superficie de Intervención</td>
                <td>${(isAdvanced ? res.surfaceArea : res.area).toLocaleString('es-AR', { maximumFractionDigits: 1 })}</td>
                <td>m²</td>
                <td>Equivale a ${((isAdvanced ? res.surfaceArea : res.area) / 10000).toFixed(3)} hectáreas</td>
              </tr>
              <tr>
                <td>Factor de Esponjamiento de Suelo (Corte)</td>
                <td>+${proj.bulkingFactor || 15} %</td>
                <td>%</td>
                <td>Abultamiento volumétrico al excavar y cargar en camiones</td>
              </tr>
              <tr>
                <td>Factor de Compactación de Suelo (Relleno)</td>
                <td>+${proj.shrinkageFactor || 10} %</td>
                <td>%</td>
                <td>Volumen adicional en banco necesario para alcanzar densidad de terraplén</td>
              </tr>
              <tr>
                <td>Tolerancia de Cota Cero (Equilibrio)</td>
                <td>± 0,005</td>
                <td>m</td>
                <td>Banda de compensación neutra</td>
              </tr>
            </tbody>
          </table>
          <div class="math-notes">
            <p><strong>Convención de Signos Oficial:</strong></p>
            <ul>
              <li><strong>Corte / Desmonte (+):</strong> Cota de Terreno Natural superior a la Rasante de Proyecto ($z_{nat} > z_{proj}$).</li>
              <li><strong>Relleno / Terraplén (-):</strong> Cota de Rasante de Proyecto superior al Terreno Natural ($z_{proj} > z_{nat}$).</li>
              <li><strong>Volumen Total Bruto Movilizado:</strong> $V_{total} = |V_{corte}| + |V_{relleno}|$ (determina tiempos operativos y desgaste de equipo).</li>
              <li><strong>Balance Neto de Tierras:</strong> $V_{neto} = V_{corte} - V_{relleno}$ (determina necesidad de vertedero o préstamo).</li>
            </ul>
          </div>
        </div>

        <!-- Resumen de Volúmenes y Cubicaciones -->
        <div class="report-section">
          <h4 class="section-title">3. CUADRO RESUMEN DE VOLÚMENES Y BALANCE DE TIERRAS</h4>
          <table class="report-table highlight-table">
            <thead>
              <tr>
                <th>Concepto de Movimiento</th>
                <th>Volumen en Banco (m³)</th>
                <th>Volumen Operativo (m³)</th>
                <th>Área Afectada (m²)</th>
                <th>Profundidad Media (m)</th>
              </tr>
            </thead>
            <tbody>
              <tr class="row-cut">
                <td><strong>DESMONTE / CORTE</strong></td>
                <td style="font-weight: 700;">${res.cutVolume.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</td>
                <td>${res.expandedCutVolume.toLocaleString('es-AR', { maximumFractionDigits: 2 })} (Esponjado)</td>
                <td>${res.cutArea.toLocaleString('es-AR', { maximumFractionDigits: 1 })}</td>
                <td>${res.avgCut ? res.avgCut.toFixed(2) : (res.avgCutDepth ? res.avgCutDepth.toFixed(2) : '0.00')} m</td>
              </tr>
              <tr class="row-fill">
                <td><strong>TERRAPLÉN / RELLENO</strong></td>
                <td style="font-weight: 700;">${res.fillVolume.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</td>
                <td>${res.requiredFillVolume.toLocaleString('es-AR', { maximumFractionDigits: 2 })} (En Préstamo)</td>
                <td>${res.fillArea.toLocaleString('es-AR', { maximumFractionDigits: 1 })}</td>
                <td>${res.avgFill ? res.avgFill.toFixed(2) : (res.avgFillHeight ? res.avgFillHeight.toFixed(2) : '0.00')} m</td>
              </tr>
              <tr class="row-total">
                <td><strong>MOVIMIENTO TOTAL BRUTO</strong></td>
                <td style="font-weight: 700;">${res.totalVolume.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</td>
                <td>-</td>
                <td>${(isAdvanced ? res.surfaceArea : res.area).toLocaleString('es-AR', { maximumFractionDigits: 1 })}</td>
                <td>-</td>
              </tr>
              <tr class="row-balance">
                <td><strong>BALANCE NETO DE MASAS</strong></td>
                <td style="font-weight: 700; color: ${res.netBalance >= 0 ? '#ef4444' : '#3b82f6'};">${netSign}${res.netBalance.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</td>
                <td colspan="3" style="font-weight: 600;">${netDiagnosis}</td>
              </tr>
            </tbody>
          </table>
          <p style="margin-top: 8px; font-size: 12px; color: #475569;">
            * Estimación logística: Se prevén aproximadamente <strong>${res.truckLoads} viajes de camión volquete de 15 m³</strong> de capacidad para el transporte de tierras.
          </p>
        </div>

        ${scenariosRows ? `
        <!-- Comparativa de Escenarios -->
        <div class="report-section">
          <h4 class="section-title">4. EVALUACIÓN DE ESCENARIOS Y ALTERNATIVAS DE RASANTE</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th>Alternativa de Proyecto</th>
                <th>Vol. Corte (m³)</th>
                <th>Vol. Relleno (m³)</th>
                <th>Balance Neto (m³)</th>
                <th>Mov. Total (m³)</th>
                <th>Costo Est. ($ ARS)</th>
              </tr>
            </thead>
            <tbody>
              ${scenariosRows}
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- Firmas y Responsables Técnicos -->
        <div class="report-section signature-section">
          <h4 class="section-title">5. FIRMAS DE RESPONSABILIDAD TÉCNICA Y ACADÉMICA</h4>
          <div class="signature-grid">
            <div class="signature-box">
              <div class="signature-line"></div>
              <p class="sig-name">Graiff Ignacio</p>
              <p class="sig-id">Legajo UTN: 425253</p>
              <p class="sig-role">Estudiante Ingeniería Civil</p>
            </div>
            <div class="signature-box">
              <div class="signature-line"></div>
              <p class="sig-name">Soledad Abigail Paredes</p>
              <p class="sig-id">Legajo UTN: 426729</p>
              <p class="sig-role">Estudiante Ingeniería Civil</p>
            </div>
            <div class="signature-box">
              <div class="signature-line"></div>
              <p class="sig-name">Máximo Valentino Broggi</p>
              <p class="sig-id">Legajo UTN: 428269</p>
              <p class="sig-role">Estudiante Ingeniería Civil</p>
            </div>
            <div class="signature-box">
              <div class="signature-line"></div>
              <p class="sig-name">Cátedra Fundamentos de Informática</p>
              <p class="sig-id">Ing. Ayrala / Ing. Foradori / Lic. Rabozzi</p>
              <p class="sig-role">Visado Docente FRC</p>
            </div>
          </div>
        </div>

        <!-- Pie de Página Legal -->
        <div class="report-footer">
          <p>Documento técnico generado automáticamente por <strong>TopoTerra Civil Studio</strong> — Módulo de Cubicaciones de Tierras inspirado en Pix4Dmapper. Cumplimiento de la Competencia 1.2 CONFEDI.</p>
        </div>
      </div>
    `;
  }

  /**
   * Imprime el informe técnico a través del diálogo de impresión nativo
   */
  static printReport() {
    window.print();
  }

  /**
   * Genera y descarga el informe técnico en PDF formateado usando html2canvas + jsPDF
   */
  static async exportToPDF() {
    const reportElem = document.getElementById('printable-report') || document.getElementById('technical-report-container');
    if (!reportElem) {
      window.print();
      return;
    }

    try {
      const jsPdfModule = window.jspdf ? (window.jspdf.jsPDF || window.jspdf) : window.jsPDF;
      if (typeof html2canvas === 'undefined' || !jsPdfModule) {
        console.warn("Librerías html2canvas o jsPDF no disponibles, ejecutando impresión nativa.");
        window.print();
        return;
      }

      // Renderizar sobre un clon preparado para impresión en alta definición
      const clone = reportElem.cloneNode(true);
      clone.style.width = '780px';
      clone.style.padding = '30px';
      clone.style.background = '#ffffff';
      clone.style.color = '#0f172a';
      clone.style.position = 'fixed';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.zIndex = '-999';
      document.body.appendChild(clone);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      document.body.removeChild(clone);

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPdfModule('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pdfWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - (margin * 2));

      while (heightLeft > 0) {
        pdf.addPage();
        position = heightLeft - imgHeight + margin;
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - (margin * 2));
      }

      const proj = AppState.getActiveProject();
      const filename = `${proj.name.replace(/\s+/g, '_')}_Memoria_Tecnica.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error("Error al exportar PDF con html2canvas y jsPDF:", err);
      window.print();
    }
  }

  /**
   * Descarga la nube de puntos con coordenadas y cotas calculadas en formato CSV
   */
  static downloadPointsCSV() {
    const proj = AppState.getActiveProject();
    if (proj.mode !== 'advanced') {
      alert("La exportación de malla de puntos en CSV requiere un proyecto en Modo Avanzado.");
      return;
    }

    const gridData = AppState.getEffectiveGridData();
    const rows = gridData.points.map(p => {
      const delta = p.zNat - p.zProj;
      return {
        ID: p.id,
        Fila: p.row + 1,
        Columna: p.col + 1,
        X_m: p.x.toFixed(3),
        Y_m: p.y.toFixed(3),
        Z_Natural_m: p.zNat.toFixed(3),
        Z_Proyecto_m: p.zProj.toFixed(3),
        DeltaH_m: delta.toFixed(3),
        Condicion: delta > 0.005 ? 'CORTE' : (delta < -0.005 ? 'RELLENO' : 'EQUILIBRIO')
      };
    });

    const csvContent = Papa.unparse(rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${proj.name.replace(/\s+/g, '_')}_puntos_topograficos.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Descarga el reporte resumido celda por celda con las diferencias de altura (Δh), área y volúmenes calculados
   */
  static downloadVolumeSummaryCSV() {
    const proj = AppState.getActiveProject();
    const res = AppState.currentResults;
    if (!res) return;

    let rows = [];

    if (proj.mode === 'advanced' && res.cells && res.cells.length > 0) {
      rows = res.cells.map(c => ({
        Celda: `C-${c.row + 1}-${c.col + 1}`,
        Fila: c.row + 1,
        Columna: c.col + 1,
        Centro_X_m: c.centerX.toFixed(2),
        Centro_Y_m: c.centerY.toFixed(2),
        Area_m2: (c.cellCutArea + c.cellFillArea).toFixed(2),
        DeltaH_Media_m: c.meanDelta.toFixed(3),
        Volumen_Corte_m3: c.cellCutVol.toFixed(3),
        Volumen_Relleno_m3: c.cellFillVol.toFixed(3),
        Balance_Celda_m3: (c.cellCutVol - c.cellFillVol).toFixed(3),
        Tipo_Operacion: c.cellType
      }));

      // Fila separadora y totales
      rows.push({
        Celda: "--- TOTALES PROYECTO ---",
        Fila: "-",
        Columna: "-",
        Centro_X_m: "-",
        Centro_Y_m: "-",
        Area_m2: res.surfaceArea.toFixed(2),
        DeltaH_Media_m: res.avgDeltaH.toFixed(3),
        Volumen_Corte_m3: res.cutVolume.toFixed(2),
        Volumen_Relleno_m3: res.fillVolume.toFixed(2),
        Balance_Celda_m3: res.netBalance.toFixed(2),
        Tipo_Operacion: res.netBalance >= 0 ? 'SOBRANTE' : 'FALTANTE'
      });
    } else {
      // Modo simple
      rows.push({
        Celda: "Macro-Zona Uniforme",
        Fila: 1,
        Columna: 1,
        Centro_X_m: 0,
        Centro_Y_m: 0,
        Area_m2: res.area.toFixed(2),
        DeltaH_Media_m: res.deltaH.toFixed(3),
        Volumen_Corte_m3: res.cutVolume.toFixed(2),
        Volumen_Relleno_m3: res.fillVolume.toFixed(2),
        Balance_Celda_m3: res.netBalance.toFixed(2),
        Tipo_Operacion: res.status
      });
    }

    const csvContent = Papa.unparse(rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${proj.name.replace(/\s+/g, '_')}_resumen_volumenes_celdas.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Genera y descarga un archivo DXF ASCII estructurado (AutoCAD / QGIS)
   * con secciones HEADER y ENTITIES conteniendo puntos 3D (POINT) y caras 3D (3DFACE)
   */
  static downloadDXF() {
    const proj = AppState.getActiveProject();
    if (proj.mode !== 'advanced') {
      alert("La exportación CAD DXF requiere una malla de puntos en Modo Avanzado.");
      return;
    }

    const gridData = AppState.getEffectiveGridData();
    const { rows, cols, points } = gridData;
    const matrix = AppState.currentResults ? AppState.currentResults.gridMatrix : null;

    let dxf = "";
    // 1. Sección HEADER estándar AutoCAD
    dxf += "0\nSECTION\n";
    dxf += "2\nHEADER\n";
    dxf += "9\n$ACADVER\n";
    dxf += "1\nAC1015\n"; // AutoCAD 2000/2002/2004/2006 compatible
    dxf += "9\n$INSUNITS\n";
    dxf += "70\n6\n"; // Metros
    dxf += "0\nENDSEC\n";

    // 2. Sección ENTITIES
    dxf += "0\nSECTION\n";
    dxf += "2\nENTITIES\n";

    // Puntos de Terreno Natural en capa "TERRENO_NATURAL_PUNTOS"
    points.forEach(p => {
      dxf += "0\nPOINT\n8\nTERRENO_NATURAL_PUNTOS\n10\n" + p.x.toFixed(3) + "\n20\n" + p.y.toFixed(3) + "\n30\n" + p.zNat.toFixed(3) + "\n";
    });

    // Puntos de Rasante en capa "RASANTE_PROYECTO_PUNTOS"
    points.forEach(p => {
      dxf += "0\nPOINT\n8\nRASANTE_PROYECTO_PUNTOS\n10\n" + p.x.toFixed(3) + "\n20\n" + p.y.toFixed(3) + "\n30\n" + p.zProj.toFixed(3) + "\n";
    });

    // Caras 3DFACE para Malla de Terreno Natural y Rasante si la matriz está disponible
    if (matrix) {
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const p1 = matrix[r][c];
          const p2 = matrix[r][c + 1];
          const p3 = matrix[r + 1][c + 1];
          const p4 = matrix[r + 1][c];
          if (!p1 || !p2 || !p3 || !p4) continue;

          // 3DFACE Terreno Natural
          dxf += "0\n3DFACE\n8\nTERRENO_NATURAL_MALLA\n";
          dxf += "10\n" + p1.x.toFixed(3) + "\n20\n" + p1.y.toFixed(3) + "\n30\n" + p1.zNat.toFixed(3) + "\n";
          dxf += "11\n" + p2.x.toFixed(3) + "\n21\n" + p2.y.toFixed(3) + "\n31\n" + p2.zNat.toFixed(3) + "\n";
          dxf += "12\n" + p3.x.toFixed(3) + "\n22\n" + p3.y.toFixed(3) + "\n32\n" + p3.zNat.toFixed(3) + "\n";
          dxf += "13\n" + p4.x.toFixed(3) + "\n23\n" + p4.y.toFixed(3) + "\n33\n" + p4.zNat.toFixed(3) + "\n";

          // 3DFACE Rasante Proyecto
          dxf += "0\n3DFACE\n8\nRASANTE_PROYECTO_MALLA\n";
          dxf += "10\n" + p1.x.toFixed(3) + "\n20\n" + p1.y.toFixed(3) + "\n30\n" + p1.zProj.toFixed(3) + "\n";
          dxf += "11\n" + p2.x.toFixed(3) + "\n21\n" + p2.y.toFixed(3) + "\n31\n" + p2.zProj.toFixed(3) + "\n";
          dxf += "12\n" + p3.x.toFixed(3) + "\n22\n" + p3.y.toFixed(3) + "\n32\n" + p3.zProj.toFixed(3) + "\n";
          dxf += "13\n" + p4.x.toFixed(3) + "\n23\n" + p4.y.toFixed(3) + "\n33\n" + p4.zProj.toFixed(3) + "\n";
        }
      }
    }

    dxf += "0\nENDSEC\n";
    dxf += "0\nEOF\n";

    const blob = new Blob([dxf], { type: 'application/dxf;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${proj.name.replace(/\s+/g, '_')}_modelo_cad3d.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

window.ReportExporter = ReportExporter;
