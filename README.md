# TopoTerra Civil Studio — Dashboard Profesional de Topografía y Movimiento de Suelos

**Software de Ingeniería Civil y Topografía para Cubicación y Balance de Masas (Corte y Relleno)**  
*Inspirado en los módulos de cubicación de Pix4Dmapper y herramientas geoespaciales avanzadas.*

---

## 🏛️ Contexto Institucional y Académico
- **Institución:** Universidad Tecnológica Nacional (UTN) — Facultad Regional Córdoba (FRC)
- **Departamento:** Ingeniería Civil
- **Cátedra:** Fundamentos de Informática (Comisión 1C2 — Ciclo Lectivo 2026)
- **Trabajo:** Trabajo Práctico Final Integrador (TFI)
- **Docentes:** Ing. Luciano Ayrala Quiroga, Ing. Carla Inés Foradori, Esp. Lic. Marcelo Juan Rabozzi.
- **Autores / Proyectistas:**
  - Graiff Ignacio — Legajo: 425253
  - Soledad Abigail Paredes — Legajo: 426729
  - Máximo Valentino Broggi — Legajo: 428269
- **Descriptor CONFEDI:** Topografía y Geodesia — **Competencia 1.2 del Libro Rojo**: *"Medir, calcular y representar planialtimétricamente el terreno y las obras construidas y a construirse, con sus implicancias legales"*.
- **Software Base de Referencia:** Pix4Dmapper (Pix4D SA) — Módulo de Cubicación de Movimiento de Suelos.

---

## 🚀 Cómo Ejecutar la Aplicación

La aplicación está construida con tecnologías web estándar modernas (HTML5 semántico, CSS3 Vanilla profesional con temas claro/oscuro, JavaScript ES6+, WebGL Three.js y Chart.js). Todas las librerías necesarias están incluidas localmente en la carpeta `vendor/`, lo que permite un **funcionamiento 100% offline sin necesidad de Node.js ni conexión a Internet**.

### Opción 1: Servidor Local con Python (Recomendado)
Desde la terminal PowerShell o CMD:
```bash
cd "C:\Users\nanog\.gemini\antigravity-ide\scratch\topocut-dashboard"
python -m http.server 8080
```
Luego abrir el navegador en:
👉 **[http://localhost:8080](http://localhost:8080)**

### Opción 2: Apertura Directa en Navegador
Hacer doble clic directamente sobre el archivo `index.html` en el explorador de archivos.

---

## 📐 Fundamentos Matemáticos y Geotécnicos

### 1. Convención de Signos Oficial
Para cualquier punto o nodo topográfico con coordenadas $(X, Y)$:
$$\Delta h = Z_{\text{natural}} - Z_{\text{proyecto}}$$
- **$\Delta h > +0.005\text{ m}$ $\rightarrow$ CORTE (Desmonte):** El terreno natural está por encima de la rasante proyectada. Se requiere excavar.
- **$\Delta h < -0.005\text{ m}$ $\rightarrow$ RELLENO (Terraplén):** La rasante proyectada se encuentra por encima del terreno natural. Se requiere terraplenar.
- **$|\Delta h| \le 0.005\text{ m}$ $\rightarrow$ EQUILIBRIO / COTA CERO:** Compensación neutra dentro de la tolerancia milimétrica de obra.

### 2. Magnitudes Clave de Movimiento de Suelos
- **Volumen Total Bruto Movilizado:**
  $$V_{\text{total}} = |V_{\text{corte}}| + |V_{\text{relleno}}|$$
  Determina el desgaste de maquinaria, ciclos de carga, horas de excavadora y costo operativo global.
- **Balance Neto de Tierras:**
  $$V_{\text{neto}} = V_{\text{corte}} - V_{\text{relleno}}$$
  - Si $V_{\text{neto}} > 0$: Excedente de material que debe transportarse a vertedero o acopio.
  - Si $V_{\text{neto}} < 0$: Déficit de material que exige aporte de cantera de préstamo externa.

### 3. Método de Integración Avanzada (Sub-Prismas Triangulares TIN con Cota Roja Nula)
A diferencia de los cálculos simplificados que promedian celdas enteras (provocando que el corte y el relleno se cancelen mutuamente de forma artificial), **TopoTerra** descompone cada cuadrícula en 2 triángulos y detecta el paso de la línea de cota cero interpolada:
- Si los vértices tienen signos mixtos (+ y -), se calculan las fracciones de borde $t_1, t_2$ y se subdivide geométricamente el prisma en un tetraedro de corte y un prisma truncado de relleno.
- Esto preserva estrictamente los volúmenes reales de excavación y terraplén de acuerdo con los estándares de diseño vial y minero.

### 4. Factores Geotécnicos
- **Factor de Esponjamiento ($F_e$, típicamente +15% a +25%):** Al descompactar el suelo virgen durante la excavación, el volumen suelto en camiones aumenta: $V_{\text{esponjado}} = V_{\text{corte}} \times (1 + F_e)$.
- **Factor de Compactación ($F_c$, típicamente +8% a +15%):** El terraplén apisonado requiere un volumen mayor en banco de préstamo para alcanzar la densidad Proctor requerida.

---

## 🛠️ Arquitectura del Sistema

```
topocut-dashboard/
├── index.html            # Estructura semántica, paneles, modales y accesibilidad
├── css/
│   └── styles.css        # Sistema de diseño UI/UX (temas Dark/Light, responsive y @media print)
├── js/
│   ├── constants.js      # Metadatos UTN, paleta técnica y 3 proyectos demo realistas
│   ├── math-engine.js    # Motor de cálculo de cubicaciones, TIN sub-cell y suite de tests
│   ├── state.js          # Gestor de estado, persistencia LocalStorage, CSV y JSON
│   ├── viewer-2d.js      # Visor 2D en Canvas con Heatmap, zoom, paneo y HUD
│   ├── viewer-3d.js      # Visor 3D WebGL con Three.js, exageración vertical y prismas
│   ├── charts.js         # Gráficos Chart.js (perfil longitudinal, transversal, histograma)
│   ├── reports.js        # Generador de Memoria Técnica oficial, exportador CSV y DXF CAD
│   └── app.js            # Controlador principal de eventos y modales
├── vendor/               # Librerías locales descargadas para funcionamiento offline
│   ├── chart.umd.min.js
│   ├── three.min.js
│   ├── OrbitControls.js
│   ├── papaparse.min.js
│   ├── jspdf.umd.min.js
│   └── html2canvas.min.js
└── README.md             # Documentación técnica completa
```

---

## 🧪 Suite de Verificación Numérica (6 Casos de Prueba)
Integrada directamente en la pestaña **"Verificación y Tests"**:
1. **Terreno natural y rasante idénticos:** Verifica que $V_{\text{corte}} = 0$, $V_{\text{relleno}} = 0$ y estado `EQUILIBRIO`.
2. **Corte uniforme puro:** Verifica que $V_{\text{corte}} = A \cdot \Delta h$ y $V_{\text{relleno}} = 0$.
3. **Relleno uniforme puro:** Verifica que $V_{\text{relleno}} = A \cdot |\Delta h|$ y $V_{\text{corte}} = 0$.
4. **Diferencias de altura variables en malla:** Verifica cálculo tridimensional de prismas.
5. **Caso mixto en la misma celda:** Comprueba que la subdivisión TIN no anula volúmenes concurrentes.
6. **Detección y rechazo de datos inválidos:** Verifica validación de áreas negativas o valores no numéricos.
