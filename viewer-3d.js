/**
 * TopoTerra Civil Pro - 3D Interactive WebGL Terrain & Grade Viewer
 * Renderizado de Superficie Natural, Rasante de Proyecto, Prismas de Volumen de Suelos
 * Utiliza Three.js y OrbitControls con soporte de exageración vertical
 */

class TerrainViewer3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container || typeof THREE === 'undefined') return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.terrainMesh = null;
    this.terrainWireframe = null;
    this.gradeMesh = null;
    this.prismsGroup = null;
    this.gridHelper = null;

    this.verticalExaggeration = 2.0; // 2x por defecto para apreciar desniveles
    this.gradeOpacity = 0.65;
    this.showTerrain = true;
    this.showGrade = true;
    this.showPrisms = true;
    this.showWireframe = false;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;

    // 1. Escena
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(AppState.theme === 'dark' ? 0x0f172a : 0xf1f5f9);

    // 2. Cámara
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 3000);
    this.camera.position.set(80, 70, 90);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // No bajar debajo del horizonte
    }

    // 5. Iluminación
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 150, 100);
    this.scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0x94a3b8, 0.3);
    backLight.position.set(-100, 80, -100);
    this.scene.add(backLight);

    // 6. Grupos de objetos
    this.prismsGroup = new THREE.Group();
    this.scene.add(this.prismsGroup);

    // Ejes de referencia y animación
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    window.addEventListener('resize', () => this.onResize());
    AppState.subscribe((event) => {
      if (event === 'calculation_updated' || event === 'project_changed' || event === 'scenario_changed') {
        this.updateModel();
      } else if (event === 'theme_changed') {
        if (this.scene) {
          this.scene.background = new THREE.Color(AppState.theme === 'dark' ? 0x0f172a : 0xf1f5f9);
        }
      }
    });

    this.updateModel();
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 500;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(this.animate);
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  resetCamera() {
    if (!this.camera || !this.controls) return;
    this.camera.position.set(70, 60, 80);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  updateModel() {
    if (!this.scene) return;

    // Limpiar mallas anteriores
    if (this.terrainMesh) this.scene.remove(this.terrainMesh);
    if (this.terrainWireframe) this.scene.remove(this.terrainWireframe);
    if (this.gradeMesh) this.scene.remove(this.gradeMesh);
    if (this.gridHelper) this.scene.remove(this.gridHelper);
    while (this.prismsGroup.children.length > 0) {
      this.prismsGroup.remove(this.prismsGroup.children[0]);
    }

    const gridData = AppState.getEffectiveGridData();
    if (!gridData || AppState.getActiveProject().mode === 'simple') return;

    const { rows, cols, dx, dy, points } = gridData;
    const width = (cols - 1) * dx;
    const depth = (rows - 1) * dy;

    // Cuadrícula base en cota 0
    this.gridHelper = new THREE.GridHelper(Math.max(width, depth) * 1.3, 20, 0x3b82f6, 0x334155);
    this.gridHelper.position.y = -1;
    this.scene.add(this.gridHelper);

    // Calcular cota base de referencia para centrar el modelo en el origen
    const minZ = AppState.currentResults ? AppState.currentResults.minZNat : 100;
    const baseElevation = minZ;

    // Geometría del Terreno Natural
    const geomTerrain = new THREE.PlaneGeometry(width, depth, cols - 1, rows - 1);
    geomTerrain.rotateX(-Math.PI / 2); // Orientar horizontal en plano XZ

    const posAttr = geomTerrain.attributes.position;
    const colors = [];
    const colorCut = new THREE.Color(0xef4444);
    const colorFill = new THREE.Color(0x3b82f6);
    const colorEq = new THREE.Color(0x10b981);

    // Indexar puntos por fila y columna
    const ptMatrix = [];
    for (let r = 0; r < rows; r++) ptMatrix[r] = [];
    points.forEach(p => { ptMatrix[p.row][p.col] = p; });

    let vertexIdx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pt = ptMatrix[r][c];
        const hNat = (pt.zNat - baseElevation) * this.verticalExaggeration;
        posAttr.setY(vertexIdx, hNat);

        // Color por diferencia de cota roja
        const delta = pt.zNat - pt.zProj;
        let cVertex;
        if (delta > 0.05) {
          cVertex = colorCut.clone().lerp(new THREE.Color(0xff8888), 0.3);
        } else if (delta < -0.05) {
          cVertex = colorFill.clone().lerp(new THREE.Color(0x88ccff), 0.3);
        } else {
          cVertex = colorEq;
        }
        colors.push(cVertex.r, cVertex.g, cVertex.b);
        vertexIdx++;
      }
    }

    geomTerrain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geomTerrain.computeVertexNormals();

    const matTerrain = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.65,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    this.terrainMesh = new THREE.Mesh(geomTerrain, matTerrain);
    this.terrainMesh.visible = this.showTerrain;
    this.scene.add(this.terrainMesh);

    // Wireframe sutil del terreno
    const matWire = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      wireframe: true,
      transparent: true,
      opacity: 0.25
    });
    this.terrainWireframe = new THREE.Mesh(geomTerrain, matWire);
    this.terrainWireframe.visible = this.showWireframe;
    this.scene.add(this.terrainWireframe);

    // Geometría de la Rasante de Proyecto
    const geomGrade = new THREE.PlaneGeometry(width, depth, cols - 1, rows - 1);
    geomGrade.rotateX(-Math.PI / 2);
    const posGrade = geomGrade.attributes.position;

    vertexIdx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pt = ptMatrix[r][c];
        const hProj = (pt.zProj - baseElevation) * this.verticalExaggeration;
        posGrade.setY(vertexIdx, hProj);
        vertexIdx++;
      }
    }
    geomGrade.computeVertexNormals();

    const matGrade = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Azul cian técnico
      transparent: true,
      opacity: this.gradeOpacity,
      roughness: 0.3,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
    this.gradeMesh = new THREE.Mesh(geomGrade, matGrade);
    this.gradeMesh.visible = this.showGrade;
    this.scene.add(this.gradeMesh);

    // Prismas o Columnas de Volumen entre Rasante y Terreno
    if (this.showPrisms && AppState.currentResults && AppState.currentResults.cells) {
      const halfW = width / 2;
      const halfD = depth / 2;
      const prismWidth = dx * 0.75;
      const prismDepth = dy * 0.75;

      AppState.currentResults.cells.forEach(cell => {
        const hNatMean = ((ptMatrix[cell.row][cell.col].zNat + ptMatrix[cell.row][cell.col + 1].zNat +
          ptMatrix[cell.row + 1][cell.col].zNat + ptMatrix[cell.row + 1][cell.col + 1].zNat) / 4 - baseElevation) * this.verticalExaggeration;
        const hProjMean = ((ptMatrix[cell.row][cell.col].zProj + ptMatrix[cell.row][cell.col + 1].zProj +
          ptMatrix[cell.row + 1][cell.col].zProj + ptMatrix[cell.row + 1][cell.col + 1].zProj) / 4 - baseElevation) * this.verticalExaggeration;

        const delta = hNatMean - hProjMean;
        const heightPrism = Math.max(0.1, Math.abs(delta));
        const posY = Math.min(hNatMean, hProjMean) + heightPrism / 2;

        const posX = cell.centerX - halfW;
        const posZ = cell.centerY - halfD;

        const pGeom = new THREE.BoxGeometry(prismWidth, heightPrism, prismDepth);
        const isCut = delta > 0.05;
        const pMat = new THREE.MeshStandardMaterial({
          color: isCut ? 0xef4444 : 0x3b82f6,
          transparent: true,
          opacity: 0.7,
          roughness: 0.4
        });
        const prismMesh = new THREE.Mesh(pGeom, pMat);
        prismMesh.position.set(posX, posY, posZ);
        this.prismsGroup.add(prismMesh);
      });
    }

    if (this.controls) {
      this.controls.target.set(0, (AppState.currentResults.avgDeltaH || 0) * this.verticalExaggeration, 0);
    }
  }

  setVerticalExaggeration(val) {
    this.verticalExaggeration = Number(val) || 1.0;
    this.updateModel();
  }

  setGradeOpacity(val) {
    this.gradeOpacity = Number(val) || 0.65;
    if (this.gradeMesh) {
      this.gradeMesh.material.opacity = this.gradeOpacity;
    }
  }

  toggleTerrain(visible) {
    this.showTerrain = visible;
    if (this.terrainMesh) this.terrainMesh.visible = visible;
  }

  toggleGrade(visible) {
    this.showGrade = visible;
    if (this.gradeMesh) this.gradeMesh.visible = visible;
  }

  togglePrisms(visible) {
    this.showPrisms = visible;
    if (this.prismsGroup) this.prismsGroup.visible = visible;
  }

  toggleWireframe(visible) {
    this.showWireframe = visible;
    if (this.terrainWireframe) this.terrainWireframe.visible = visible;
  }
}

window.TerrainViewer3D = TerrainViewer3D;
