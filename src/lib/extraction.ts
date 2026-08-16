// =====================================================================
// Extracción de facturas con IA (Fase 1)
// Schema del tool, prompt y mapeos. Data pura: se usa tanto en el endpoint
// server-side (/api/extract) como en la UI de revisión (tipos + mapeo).
// =====================================================================

// Modelo y versión de prompt: quedan registrados en extraction_jobs para
// trazabilidad (poder reproducir qué produjo cada extracción).
export const EXTRACTION_MODEL = 'claude-sonnet-4-6'
export const PROMPT_VERSION = 'v1'

export const TIPOS_FUENTE = [
  'electricidad', 'gasoil', 'nafta', 'glp', 'gas_natural', 'fueloil', 'lena', 'otro',
] as const
export type TipoFuente = (typeof TIPOS_FUENTE)[number]

export type ExtractionItem = {
  concepto: string
  cantidad: number | null
  unidad: string | null
  periodo: string | null
}

export type ExtractionResult = {
  proveedor: string | null
  fecha: string | null            // ISO YYYY-MM-DD
  tipo_fuente: TipoFuente
  moneda: string | null
  items: ExtractionItem[]
  confianza: number | null        // 0..1
  notas: string | null
}

// tipo_fuente detectado → nombre del emission_factor sembrado en la Fase 0.
// El factor determina category_key + kg CO2e/unidad. 'otro' no mapea.
export const TIPO_FUENTE_TO_FACTOR: Record<TipoFuente, string | null> = {
  electricidad: 'Electricidad de red (UTE)',
  gasoil: 'Gasoil (Diésel)',
  nafta: 'Nafta (Gasolina)',
  glp: 'Supergás (GLP)',
  gas_natural: 'Gas natural',
  fueloil: 'Fuel oil (Fueloil)',
  lena: 'Leña / Biomasa (biogénico)',
  otro: null,
}

// Tool de Anthropic: fuerza salida estructurada (JSON validado por el schema).
export const EXTRACTION_TOOL = {
  name: 'registrar_datos_factura',
  description:
    'Registra los datos de actividad extraídos de una factura o remito para un inventario de huella de carbono.',
  input_schema: {
    type: 'object' as const,
    properties: {
      proveedor: { type: ['string', 'null'], description: 'Nombre del proveedor emisor (ej. UTE, ANCAP, la estación de servicio).' },
      fecha: { type: ['string', 'null'], description: 'Fecha del documento en formato ISO YYYY-MM-DD. Si solo hay período (mes/año), usar el primer día del mes.' },
      tipo_fuente: {
        type: 'string',
        enum: [...TIPOS_FUENTE],
        description: 'Tipo de fuente de emisión. electricidad=consumo eléctrico de red (kWh); gasoil=diésel; nafta=gasolina; glp=supergás; gas_natural; fueloil; lena=leña/biomasa; otro=si no encaja.',
      },
      moneda: { type: ['string', 'null'], description: 'Moneda del documento si aparece (ej. UYU, USD).' },
      items: {
        type: 'array',
        description: 'Una fila por cada consumo/carga medible del documento. Una boleta de electricidad suele ser 1 item; un estado de cuenta de combustible puede tener varios.',
        items: {
          type: 'object',
          properties: {
            concepto: { type: 'string', description: 'Descripción breve del consumo (ej. "Consumo eléctrico julio", "Carga gasoil").' },
            cantidad: { type: ['number', 'null'], description: 'Cantidad consumida (número). NO el monto en dinero: la cantidad física (kWh, litros, kg, m³).' },
            unidad: { type: ['string', 'null'], description: 'Unidad de la cantidad (kWh, L, kg, m3).' },
            periodo: { type: ['string', 'null'], description: 'Período del consumo si difiere de la fecha (ej. "Jul-2026").' },
          },
          required: ['concepto', 'cantidad', 'unidad'],
        },
      },
      confianza: { type: ['number', 'null'], description: 'Confianza global de la extracción, 0 a 1.' },
      notas: { type: ['string', 'null'], description: 'Aclaraciones, ambigüedades o datos dudosos para que el humano revise.' },
    },
    required: ['proveedor', 'fecha', 'tipo_fuente', 'items', 'confianza'],
  },
}

export const SYSTEM_PROMPT = `Sos un asistente experto en leer facturas y remitos uruguayos para cargar un inventario de huella de carbono (ISO 14064-1).

Tu tarea: leer el documento adjunto y extraer los DATOS DE ACTIVIDAD (cuánto se consumió), no el dinero. Devolvés el resultado llamando a la herramienta registrar_datos_factura.

Reglas:
- Extraé la CANTIDAD FÍSICA consumida, no el importe en pesos. Ejemplos: una boleta de UTE trae kWh; un ticket de combustible trae litros; supergás en kg; gas natural en m³.
- Facturas UTE → tipo_fuente=electricidad, unidad kWh. Combustible gasoil/diésel → gasoil, litros. Nafta/gasolina → nafta, litros.
- Si el documento tiene varias cargas/consumos (ej. estado de cuenta), devolvé un item por cada uno.
- Fechas en formato ISO YYYY-MM-DD. Si solo hay mes/año, usá el primer día del mes.
- Los documentos están en español y los números suelen usar coma decimal y punto de miles (ej. "1.240,5" = 1240.5). Convertí correctamente a número.
- Si algo no está claro o falta, dejalo en null y explicá la duda en "notas". NO inventes cantidades.
- Ajustá "confianza" según qué tan legible y completo esté el documento.`
