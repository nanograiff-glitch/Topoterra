/**
 * TopoTerra Civil Pro - 2D Plan & Heatmap Terrain Viewer
 * Vista en planta 2D interactiva con mapa de calor de cota roja (corte/relleno),
 * cuadrícula topográfica, selección de perfiles y tooltips dinámicos.
 */

class TerrainViewer2D {
  constructor(canvasId, containerId) {
    this.canvas = document.getElementById(canvasId);
    this.container = document.getElementById(containerId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    this.showLabels = true;
    this.showGrid = true;
    this.showZeroLine = true;
    this.hoveredCell = null;
    this.selectedCell = null;

    this.initEvents();
    this.resize();
  }

  initEvents() {
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX - this.offsetX;
      this.dragStartY = e.clientY - this.offsetY;
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.offsetX = e.clientX - this.dragStartX;
        this.offsetY = e.clientY - this.dragStartY;
        this.render();
      } else {
        this.handleHover(e);
      }
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.offsetX = mouseX - (mouseX - this.offsetX) * zoomFactor;
      this.offsetY = mouseY - (mouseY - this.offsetY) * zoomFactor;
      this.scale *= zoomFactor;
      this.render();
    }, { passive: false });

    this.canvas.addEventListener('click', (e) => {
      if (this.hoveredCell) {
        this.selectedCell = this.hoveredCell;
        AppState.selectedPoint = this.hoveredCell.point;
        AppState.notify('point_selected', this.hoveredCell);
        this.render();
      }
    });
  }

  resize() {
    if (!this.container || !this.canvas) return;
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio || 800;
    this.canvas.height = (rect.height || 500) * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.fitToView();
  }

  fitToView() {
    const gridData = AppState.getEffectiveGridData();
    if (!gridData) return;

    const widthM = (gridData.cols - 1) * gridData.dx;
    const heightM = (gridData.rows - 1) * gridData.dy;
    const canvasW = this.canvas.width / window.devicePixelRatio;
    const canvasH = this.canvas.height / window.devicePixelRatio;

    const margin = 70;
    const scaleX = (canvasW - margin * 2) / (widthM || 1);
    const scaleY = (canvasH - margin * 2) / (heightM || 1);
    this.scale = Math.min(scaleX, scaleY);

    this.offsetX = (canvasW - widthM * this.scale) / 2;
    this.offsetY = (canvasH - heightM * this.scale) / 2;

    this.render();
  }

  /**
   * Color de mapa de calor según cota roja (Delta H = Znat - Zproj)
   */
  getColorForDelta(deltaH, maxVal = 2.0) {
    const val = Math.max(-maxVal, Math.min(maxVal, deltaH));
    if (Math.abs(deltaH) <= 0.02) {
      return '#10b981'; // Cota cero equilibrada
    }

    if (deltaH > 0) {
      // Corte: Naranja a Rojo fuerte
      const t = Math.min(1, deltaH / maxVal);
      const r = Math.round(239 + (220 - 239) * t);
      const g = Math.round(140 * (1 - t * 0.7));
      const b = Math.round(50 * (1 - t));
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Relleno: Celeste a Azul marino profundo
      const t = Math.min(1, -deltaH / maxVal);
      const r = Math.round(40 * (1 - t));
      const g = Math.round(130 + (70 - 130) * t);
      const b = Math.round(246);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  handleHover(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const gridData = AppState.getEffectiveGridData();
    if (!gridData || !AppState.currentResults || !AppState.currentResults.gridMatrix) return;

    const worldX = (mouseX - this.offsetX) / this.scale;
    const worldY = (mouseY - this.offsetY) / this.scale;

    const col = Math.round(worldX / gridData.dx);
    const row = Math.round(worldY / gridData.dy);

    if (row >= 0 && row < gridData.rows && col >= 0 && col < gridData.cols) {
      const pt = AppState.currentResults.gridMatrix[row][col];
      this.hoveredCell = { row, col, point: pt, screenX: mouseX, screenY: mouseY };
      this.canvas.style.cursor = 'pointer';
    } else {
      this.hoveredCell = null;
      this.canvas.style.cursor = 'grab';
    }
    this.render();
  }

  render() {
    if (!this.ctx) return;
    const canvasW = this.canvas.width / window.devicePixelRatio;
    const canvasH = this.canvas.height / window.devicePixelRatio;

    this.ctx.clearRect(0, 0, canvasW, canvasH);

    const gridData = AppState.getEffectiveGridData();
    if (!gridData || !AppState.currentResults || AppState.getActiveProject().mode === 'simple') {
      this.renderSimpleModeFallback(canvasW, canvasH);
      return;
    }

    const { rows, cols, dx, dy } = gridData;
    const matrix = AppState.currentResults.gridMatrix;
    const cells = AppState.currentResults.cells || [];
    const maxDelta = Math.max(0.5, AppState.currentResults.maxCutDepth, AppState.currentResults.maxFillHeight);

    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);

    // 1. Dibujar celdas del Heatmap con gradientes interpolados
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const x = c * dx;
        const y = r * dy;

        const p1 = matrix[r][c];
        const p2 = matrix[r][c + 1];
        const p3 = matrix[r + 1][c + 1];
        const p4 = matrix[r + 1][c];
        if (!p1 || !p2 || !p3 || !p4) continue;

        // Triángulo 1 (p1, p2, p3)
        const avgD1 = (p1.deltaH + p2.deltaH + p3.deltaH) / 3;
        this.ctx.fillStyle = this.getColorForDelta(avgD1, maxDelta);
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.lineTo(p3.x, p3.y);
        this.ctx.closePath();
        this.ctx.fill();

        // Triángulo 2 (p1, p3, p4)
        const avgD2 = (p1.deltaH + p3.deltaH + p4.deltaH) / 3;
        this.ctx.fillStyle = this.getColorForDelta(avgD2, maxDelta);
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p3.x, p3.y);
        this.ctx.lineTo(p4.x, p4.y);
        this.ctx.closePath();
        this.ctx.fill();
      }
    }

    // 2. Líneas de cuadrícula
    if (this.showGrid) {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      this.ctx.lineWidth = 1 / this.scale;

      for (let r = 0; r < rows; r++) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, r * dy);
        this.ctx.lineTo((cols - 1) * dx, r * dy);
        this.ctx.stroke();
      }
      for (let c = 0; c < cols; c++) {
        this.ctx.beginPath();
        this.ctx.moveTo(c * dx, 0);
        this.ctx.lineTo(c * dx, (rows - 1) * dy);
        this.ctx.stroke();
      }
    }

    // 3. Resaltar línea de perfil activo (longitudinal o transversal)
    const selProf = AppState.selectedProfile;
    if (selProf) {
      this.ctx.strokeStyle = '#f59e0b'; // Amarillo ambar
      this.ctx.lineWidth = 3 / this.scale;
      this.ctx.setLineDash([6 / this.scale, 4 / this.scale]);
      this.ctx.beginPath();
      if (selProf.type === 'longitudinal' && selProf.index < rows) {
        const y = selProf.index * dy;
        this.ctx.moveTo(0, y);
        this.ctx.lineTo((cols - 1) * dx, y);
      } else if (selProf.type === 'transverse' && selProf.index < cols) {
        const x = selProf.index * dx;
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, (rows - 1) * dy);
      }
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    // 4. Marcadores de puntos topográficos
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pt = matrix[r][c];
        if (!pt) continue;

        // Marcador de punto
        this.ctx.fillStyle = pt.deltaH > 0.02 ? '#ef4444' : (pt.deltaH < -0.02 ? '#3b82f6' : '#10b981');
        this.ctx.beginPath();
        this.ctx.arc(pt.x, pt.y, Math.min(2.5, 3 / this.scale), 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // 5. Destacar celda/punto seleccionado
    if (this.selectedCell && this.selectedCell.point) {
      const p = this.selectedCell.point;
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2.5 / this.scale;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 7 / this.scale, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    this.ctx.restore();

    // 6. Etiquetas de cotas con LOD y escalado acotado (7px - 10px)
    this.drawLabels(matrix, rows, cols, dx, dy);

    // 7. Leyenda de colores flotante (HUD)
    this.renderHUDLegend(canvasW, canvasH, maxDelta);

    // 7. Tooltip flotante si hay hovered cell
    if (this.hoveredCell && this.hoveredCell.point) {
      this.renderTooltip(this.hoveredCell);
    }
  }

  /**
   * Renderizado de cotas con escalado proporcional, límite estricto de fuente y filtro LOD
   */
  drawLabels(matrix, rows, cols, dx, dy) {
    if (!this.showLabels) return;

    // Tamaño proyectado de la celda en pantalla
    const cellWidth = dx * this.scale;
    const cellHeight = dy * this.scale;

    // 2. FILTRO DE NIVEL DE DETALLE (LOD POR ZOOM)
    // Si la celda en pantalla mide menos de 28px de ancho o alto, se omite el texto
    if (cellWidth < 28 || cellHeight < 28) {
      return;
    }

    // 1. ESCALADO Y LÍMITE MÁXIMO DE FUENTE
    // Proporcional al tamaño de la celda con límite estricto entre 7px y 10px (nunca supera 10px)
    const fontSize = Math.min(10, Math.max(7, cellWidth * 0.2));
    this.ctx.font = `${fontSize}px Inter, sans-serif`;

    // 3. ALINEACIÓN Y FORMATO DE TEXTO
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pt = matrix[r][c];
        if (!pt) continue;

        // Coordenadas en píxeles de pantalla (fuera del scale de mundo)
        const screenX = pt.x * this.scale + this.offsetX;
        const screenY = pt.y * this.scale + this.offsetY;

        // Formato numérico a un solo decimal
        const cota = pt.deltaH;
        const sign = cota >= 0 ? '+' : '';
        const text = `${sign}${cota.toFixed(1)}m`;

        // Fondo semitransparente sutil para contraste y legibilidad óptima sobre el mapa
        const textWidth = this.ctx.measureText(text).width;
        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        this.ctx.fillRect(screenX - textWidth / 2 - 2, screenY - 9 - fontSize / 2, textWidth + 4, fontSize + 2);

        // Texto de cota
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(text, screenX, screenY - 8);
      }
    }
  }

  renderHUDLegend(canvasW, canvasH, maxDelta) {
    const pad = 16;
    const barW = 180;
    const barH = 14;
    const x = canvasW - barW - pad - 20;
    const y = canvasH - barH - pad - 25;

    // Caja de fondo
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineWidth = 1;
    this.ctx.roundRect(x - 12, y - 24, barW + 24, barH + 42, 6);
    this.ctx.fill();
    this.ctx.stroke();

    // Título
    this.ctx.font = '11px Inter, sans-serif';
    this.ctx.fillStyle = '#cbd5e1';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Cota Roja (Δh = Znat - Zproj)', x - 4, y - 8);

    // Gradiente continuo
    const grad = this.ctx.createLinearGradient(x, 0, x + barW, 0);
    grad.addColorStop(0, '#3b82f6'); // Relleno (-)
    grad.addColorStop(0.5, '#10b981'); // Equilibrio (0)
    grad.addColorStop(1, '#ef4444'); // Corte (+)

    this.ctx.fillStyle = grad;
    this.ctx.fillRect(x, y, barW, barH);
    this.ctx.strokeRect(x, y, barW, barH);

    // Etiquetas numéricas
    this.ctx.font = '10px Inter, sans-serif';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`-${maxDelta.toFixed(1)}m (Relleno)`, x, y + barH + 13);
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`0.0m`, x + barW / 2, y + barH + 13);
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`+${maxDelta.toFixed(1)}m (Corte)`, x + barW, y + barH + 13);
  }

  renderTooltip(item) {
    const pt = item.point;
    const tx = item.screenX + 15;
    const ty = item.screenY - 15;
    const tw = 175;
    const th = 85;

    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    this.ctx.strokeStyle = pt.deltaH > 0.02 ? '#ef4444' : (pt.deltaH < -0.02 ? '#3b82f6' : '#10b981');
    this.ctx.lineWidth = 1.5;
    this.ctx.roundRect(tx, ty, tw, th, 6);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.font = 'bold 11px Inter, sans-serif';
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Punto: ${pt.id} [F:${pt.row}, C:${pt.col}]`, tx + 10, ty + 18);

    this.ctx.font = '11px Inter, sans-serif';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillText(`X: ${pt.x.toFixed(1)}m | Y: ${pt.y.toFixed(1)}m`, tx + 10, ty + 34);
    this.ctx.fillText(`Z Natural: ${pt.zNat.toFixed(2)} m`, tx + 10, ty + 49);
    this.ctx.fillText(`Z Rasante: ${pt.zProj.toFixed(2)} m`, tx + 10, ty + 64);

    const sign = pt.deltaH >= 0 ? '+' : '';
    this.ctx.fillStyle = pt.deltaH > 0.02 ? '#f87171' : (pt.deltaH < -0.02 ? '#60a5fa' : '#34d399');
    this.ctx.font = 'bold 11px Inter, sans-serif';
    this.ctx.fillText(`Δh: ${sign}${pt.deltaH.toFixed(2)} m (${pt.status})`, tx + 10, ty + 79);
  }

  renderSimpleModeFallback(canvasW, canvasH) {
    this.ctx.fillStyle = '#1e293b';
    this.ctx.fillRect(0, 0, canvasW, canvasH);
    this.ctx.font = '14px Inter, sans-serif';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Modo Simple Activo (Superficie Uniforme)', canvasW / 2, canvasH / 2 - 10);
    this.ctx.font = '12px Inter, sans-serif';
    this.ctx.fillText('Para ver el mapa de calor 2D celda por celda, active o cree un proyecto en Modo Avanzado.', canvasW / 2, canvasH / 2 + 15);
  }
}

window.TerrainViewer2D = TerrainViewer2D;
