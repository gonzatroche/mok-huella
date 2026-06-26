// Catálogo único de etiquetas, estados y colores del sistema de huella de
// carbono (ISO 14064-1:2018). Fuente única: la UI y los reportes muestran
// siempre lo mismo. No hardcodear strings de estado en las páginas.

// Helper: etiqueta segura para diccionarios string->string
export function label(dict: Record<string, string>, key: string | null | undefined): string {
  if (!key) return '—'
  return dict[key] ?? key
}

// ── Módulos del sistema (metadata para landings, navegación y dashboard) ──
export type Chapter = { n: number | string; slug: string; title: string; desc: string; color: string }
export const CHAPTERS: Chapter[] = [
  { n: 5, slug: 'limites',        title: 'Límites del inventario',  desc: 'Límites organizacionales, sitios y categorías de emisión', color: 'bg-sky-100 text-sky-800' },
  { n: 6, slug: 'cuantificacion', title: 'Cuantificación',          desc: 'Inventario de emisiones, fuentes, factores y año base', color: 'bg-teal-100 text-teal-800' },
  { n: 7, slug: 'mitigacion',     title: 'Mitigación',              desc: 'Objetivos y proyectos de reducción y remoción', color: 'bg-emerald-100 text-emerald-800' },
  { n: 8, slug: 'gestion-datos',  title: 'Gestión de datos',        desc: 'Evidencias, control de calidad, documentación y responsables', color: 'bg-indigo-100 text-indigo-800' },
  { n: 9, slug: 'reporte',        title: 'Reporte',                 desc: 'Consolidado, indicadores de intensidad e informe de huella', color: 'bg-amber-100 text-amber-800' },
  { n: 'V', slug: 'verificacion', title: 'Verificación',            desc: 'Verificaciones del inventario y no conformidades', color: 'bg-violet-100 text-violet-800' },
]
export const CHAPTER_BY_SLUG: Record<string, Chapter> = Object.fromEntries(CHAPTERS.map(c => [c.slug, c]))

// =====================================================================
// TRANSVERSAL — categorías ISO, unidades, trimestres
// =====================================================================
// Las 6 categorías de ISO 14064-1:2018 (deben coincidir con la tabla
// emission_categories). Color por alcance GHG Protocol asociado.
export const ISO_CATEGORIES: Record<string, { label: string; short: string; scope: string; color: string }> = {
  cat1: { label: 'Categoría 1 — Emisiones directas',                short: 'Cat. 1 · Directas',        scope: 'Alcance 1', color: 'bg-red-100 text-red-800' },
  cat2: { label: 'Categoría 2 — Energía importada',                 short: 'Cat. 2 · Energía',         scope: 'Alcance 2', color: 'bg-amber-100 text-amber-800' },
  cat3: { label: 'Categoría 3 — Transporte',                        short: 'Cat. 3 · Transporte',      scope: 'Alcance 3', color: 'bg-sky-100 text-sky-800' },
  cat4: { label: 'Categoría 4 — Productos usados',                  short: 'Cat. 4 · Productos',       scope: 'Alcance 3', color: 'bg-indigo-100 text-indigo-800' },
  cat5: { label: 'Categoría 5 — Uso de los productos',             short: 'Cat. 5 · Uso',             scope: 'Alcance 3', color: 'bg-violet-100 text-violet-800' },
  cat6: { label: 'Categoría 6 — Otras fuentes',                     short: 'Cat. 6 · Otras',           scope: 'Alcance 3', color: 'bg-gray-100 text-gray-700' },
}
export const ISO_CATEGORY_KEYS = ['cat1', 'cat2', 'cat3', 'cat4', 'cat5', 'cat6']

export const GHG_UNITS: string[] = ['L', 'kWh', 't', 'km', 'kg', 'm²', 'm³', 'unidad']

export const QUARTERS: Record<string, string> = {
  T1: 'T1 (Ene–Mar)',
  T2: 'T2 (Abr–Jun)',
  T3: 'T3 (Jul–Set)',
  T4: 'T4 (Oct–Dic)',
}

export const CONSOLIDATION_APPROACH: Record<string, string> = {
  control_operacional:    'Control operacional',
  control_financiero:     'Control financiero',
  participacion_accionaria: 'Participación accionaria',
}

// =====================================================================
// CLÁUSULA 5 — LÍMITES
// =====================================================================
export const SITE_STATUS: Record<string, { label: string; color: string }> = {
  activa:    { label: 'Activa',    color: 'bg-green-100 text-green-800' },
  terminada: { label: 'Terminada', color: 'bg-gray-100 text-gray-700' },
  en_espera: { label: 'En espera', color: 'bg-amber-100 text-amber-800' },
}

// =====================================================================
// CLÁUSULA 6 — CUANTIFICACIÓN
// =====================================================================
export const VERIFIED_STATUS: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-amber-100 text-amber-800' },
  si:        { label: 'Verificado', color: 'bg-green-100 text-green-800' },
  no:        { label: 'Observado',  color: 'bg-red-100 text-red-800' },
}

// =====================================================================
// CLÁUSULA 7 — MITIGACIÓN
// =====================================================================
export const TARGET_STATUS: Record<string, { label: string; color: string }> = {
  activo:      { label: 'Activo',      color: 'bg-blue-100 text-blue-800' },
  cumplido:    { label: 'Cumplido',    color: 'bg-green-100 text-green-800' },
  no_cumplido: { label: 'No cumplido', color: 'bg-red-100 text-red-800' },
  cerrado:     { label: 'Cerrado',     color: 'bg-gray-100 text-gray-700' },
}
export const PROJECT_TIPO: Record<string, { label: string; color: string }> = {
  reduccion: { label: 'Reducción', color: 'bg-teal-100 text-teal-800' },
  remocion:  { label: 'Remoción',  color: 'bg-emerald-100 text-emerald-800' },
}
export const PROJECT_STATUS: Record<string, { label: string; color: string }> = {
  propuesto:    { label: 'Propuesto',    color: 'bg-amber-100 text-amber-800' },
  en_curso:     { label: 'En curso',     color: 'bg-blue-100 text-blue-800' },
  implementado: { label: 'Implementado', color: 'bg-teal-100 text-teal-800' },
  verificado:   { label: 'Verificado',   color: 'bg-green-100 text-green-800' },
}

// =====================================================================
// CLÁUSULA 8 — GESTIÓN DE DATOS
// =====================================================================
export const EVIDENCE_TIPO: Record<string, string> = {
  factura:  'Factura',
  remito:   'Remito',
  registro: 'Registro / planilla',
  contrato: 'Contrato',
  otro:     'Otro',
}
export const DQC_RESULT: Record<string, { label: string; color: string }> = {
  conforme:           { label: 'Conforme',           color: 'bg-green-100 text-green-800' },
  con_observaciones:  { label: 'Con observaciones',  color: 'bg-amber-100 text-amber-800' },
  no_conforme:        { label: 'No conforme',        color: 'bg-red-100 text-red-800' },
}
export const DOC_TYPES: Record<string, string> = {
  politica:      'Política',
  manual:        'Manual',
  procedimiento: 'Procedimiento',
  instructivo:   'Instructivo',
  formato:       'Formato',
  registro:      'Registro',
  externo:       'Documento externo',
}
export const DOC_STATUS: Record<string, { label: string; color: string }> = {
  borrador:    { label: 'Borrador',    color: 'bg-gray-100 text-gray-700' },
  en_revision: { label: 'En revisión', color: 'bg-amber-100 text-amber-800' },
  vigente:     { label: 'Vigente',     color: 'bg-green-100 text-green-800' },
  obsoleto:    { label: 'Obsoleto',    color: 'bg-red-100 text-red-700' },
}

// =====================================================================
// CLÁUSULA 9 — REPORTE
// =====================================================================
export const REPORT_STATUS: Record<string, { label: string; color: string }> = {
  borrador:   { label: 'Borrador',   color: 'bg-gray-100 text-gray-700' },
  emitido:    { label: 'Emitido',    color: 'bg-blue-100 text-blue-800' },
  verificado: { label: 'Verificado', color: 'bg-green-100 text-green-800' },
}

// =====================================================================
// VERIFICACIÓN (ISO 14064-3) Y MEJORA
// =====================================================================
export const VERIFICATION_TIPO: Record<string, string> = {
  interna:       'Interna',
  externa:       'Externa',
  certificacion: 'Certificación',
}
export const VERIFICATION_STATUS: Record<string, { label: string; color: string }> = {
  planificada: { label: 'Planificada', color: 'bg-amber-100 text-amber-800' },
  en_curso:    { label: 'En curso',    color: 'bg-blue-100 text-blue-800' },
  realizada:   { label: 'Realizada',   color: 'bg-green-100 text-green-800' },
  cerrada:     { label: 'Cerrada',     color: 'bg-gray-100 text-gray-700' },
}
export const ASSURANCE_LEVEL: Record<string, string> = {
  razonable: 'Aseguramiento razonable',
  limitado:  'Aseguramiento limitado',
}
export const FINDING_TYPES: Record<string, { label: string; color: string }> = {
  error_material: { label: 'Error material', color: 'bg-red-100 text-red-800' },
  no_conformidad: { label: 'No conformidad', color: 'bg-amber-100 text-amber-800' },
  observacion:    { label: 'Observación',    color: 'bg-blue-100 text-blue-800' },
  oportunidad:    { label: 'Oportunidad',    color: 'bg-emerald-100 text-emerald-800' },
}
export const NC_SOURCES: Record<string, string> = {
  verificacion:    'Verificación',
  control_calidad: 'Control de calidad de datos',
  revision:        'Revisión por la dirección',
  requisito_legal: 'Requisito legal',
  otros:           'Otros',
}
export const NC_SEVERITY: Record<string, { label: string; color: string }> = {
  no_conformidad:     { label: 'No conformidad',        color: 'bg-red-100 text-red-800' },
  observacion:        { label: 'Observación',           color: 'bg-blue-100 text-blue-800' },
  oportunidad_mejora: { label: 'Oportunidad de mejora', color: 'bg-emerald-100 text-emerald-800' },
}
export const NC_STATUS: Record<string, { label: string; color: string }> = {
  abierta:     { label: 'Abierta',     color: 'bg-amber-100 text-amber-800' },
  para_cerrar: { label: 'Para cerrar', color: 'bg-blue-100 text-blue-800' },
  cerrada:     { label: 'Cerrada',     color: 'bg-green-100 text-green-800' },
}
export const ACTION_TYPES: Record<string, string> = {
  correctiva: 'Correctiva',
  preventiva: 'Preventiva',
  mejora:     'Mejora',
}
export const ACTION_STATUS: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-gray-100 text-gray-700' },
  en_curso:  { label: 'En curso',  color: 'bg-blue-100 text-blue-800' },
  cerrada:   { label: 'Cerrada',   color: 'bg-green-100 text-green-800' },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
}

// Formato de toneladas de CO2eq para la UI.
export function fmtT(n: number | null | undefined, decimals = 2): string {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('es', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
