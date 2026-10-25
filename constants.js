/**
 * TopoTerra Civil Pro - Constants & Default Projects
 * Datos iniciales, configuraciones institucionales y proyectos de demostración
 */

const APP_CONSTANTS = {
  APP_NAME: "TopoTerra Civil Studio",
  APP_VERSION: "2.4.0-PRO",
  ACADEMIC_INFO: {
    UNIVERSITY: "Universidad Tecnológica Nacional",
    FACULTY: "Facultad Regional Córdoba",
    DEPARTMENT: "Departamento de Ingeniería Civil",
    COURSE: "Fundamentos de Informática (Comisión 1C2 - 2026)",
    TPI_NAME: "Trabajo Práctico Final Integrador (TFI)",
    PROFESSORS: "Ing. Luciano Ayrala Quiroga, Ing. Carla Inés Foradori, Esp. Lic. Marcelo Juan Rabozzi",
    STUDENTS: [
      { name: "Graiff Ignacio", id: "425253" },
      { name: "Soledad Abigail Paredes", id: "426729" },
      { name: "Máximo Valentino Broggi", id: "428269" }
    ],
    CONFEDI_DESCRIPTOR: "Topografía y Geodesia — Competencia 1.2 del Libro Rojo: 'Medir, calcular y representar planialtimétricamente el terreno y las obras construidas y a construirse, con sus implicancias legales'",
    REFERENCE_SOFTWARE: "Pix4Dmapper (Pix4D SA) — Implementación independiente del Módulo de Volúmenes de Movimiento de Suelos"
  },
  DEFAULT_COLORS: {
    CUT_PRIMARY: "#ef4444",      // Rojo vibrante para corte (desmonte)
    CUT_SECONDARY: "#f87171",
    CUT_LIGHT: "rgba(239, 68, 68, 0.2)",
    FILL_PRIMARY: "#3b82f6",     // Azul técnico para relleno (terraplén)
    FILL_SECONDARY: "#60a5fa",
    FILL_LIGHT: "rgba(59, 130, 246, 0.2)",
    BALANCED: "#10b981",         // Verde para cota cero / equilibrio
    TERRAIN_MESH: "#64748b",
    PROJECT_GRADE: "#0284c7"
  },
  DEFAULT_PROJECTS: [
    {
      id: "proj_sierras_01",
      name: "Loteo Residencial Las Sierras",
      location: "Villa Carlos Paz, Córdoba, Argentina",
      description: "Nivelación de macizo para urbanización serrana con suelo limo-arenoso y afloramientos rocosos. Requiere compensar desmonte en loma oeste para terraplenar vaguada este.",
      date: "2026-10-24",
      mode: "advanced",
      bulkingFactor: 15, // % esponjamiento
      shrinkageFactor: 10, // % compactación
      unitCutCost: 4500, // $/m3
      unitFillCost: 5200, // $/m3
      grid: {
        rows: 11,
        cols: 11,
        dx: 5.0,
        dy: 5.0,
        terrainType: "rolling",
        baseZ: 100.0
      },
      scenarios: [
        { id: "sc_base", name: "Rasante Original (Proyecto)", offsetZ: 0, isBase: true },
        { id: "sc_opt", name: "Rasante Óptima Compensada", autoBalance: true },
        { id: "sc_high", name: "Rasante Elevada (+0.40 m)", offsetZ: 0.40 },
        { id: "sc_low", name: "Rasante Rebajada (-0.40 m)", offsetZ: -0.40 }
      ]
    },
    {
      id: "proj_parque_ind",
      name: "Plataforma Logística Parque Industrial",
      location: "Ferreyra, Córdoba, Argentina",
      description: "Explanada horizontal para nave de almacenamiento de 100x80 m. Pendiente natural del 1.5%. Se proyecta cota fija a nivel de solera para drenaje de aguas de lluvia.",
      date: "2026-10-20",
      mode: "advanced",
      bulkingFactor: 18,
      shrinkageFactor: 12,
      unitCutCost: 4200,
      unitFillCost: 4900,
      grid: {
        rows: 9,
        cols: 9,
        dx: 10.0,
        dy: 10.0,
        terrainType: "slope",
        baseZ: 450.0
      },
      scenarios: [
        { id: "sc_base", name: "Cota Rasante 452.00 m", offsetZ: 0, isBase: true },
        { id: "sc_opt", name: "Compensación de Masas", autoBalance: true }
      ]
    },
    {
      id: "proj_simple_demo",
      name: "Cálculo Rápido - Lote 12 Manzana D",
      location: "Barrio Jardín, Córdoba",
      description: "Estimación preliminar uniforme para presupuesto rápido de movimiento de suelos antes del replanteo topográfico.",
      date: "2026-10-22",
      mode: "simple",
      simpleData: {
        area: 1250,
        zNatural: 102.40,
        zProject: 101.60,
        bulkingFactor: 15,
        shrinkageFactor: 10
      },
      unitCutCost: 4500,
      unitFillCost: 5200
    }
  ]
};
