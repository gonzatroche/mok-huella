// Árbol de navegación: módulos funcionales del inventario de huella de carbono,
// mapeados a las cláusulas operativas de ISO 14064-1:2018.
// Lo usan el sidebar (AppLayout) y las landings de cada módulo.
import {
  Building2, Calculator, TrendingDown, Database, BarChart3, ShieldCheck, Globe,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = { href: string; label: string; clause: string; desc?: string }
export type NavGroup = { slug: string; n: number | string; label: string; href: string; icon: LucideIcon; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    slug: 'limites', n: 5, label: '5 · Límites', href: '/limites', icon: Building2,
    items: [
      { href: '/limites/organizacionales', clause: '5.1', label: 'Límites organizacionales', desc: 'Entidades, enfoque de consolidación y participación' },
      { href: '/limites/sitios',           clause: '5.1', label: 'Sitios e instalaciones',   desc: 'Obras, plantas y oficinas incluidas en el inventario' },
      { href: '/limites/tipos-sitio',      clause: '5.1', label: 'Tipos de sitio',           desc: 'Catálogo de tipos de instalación / obra' },
      { href: '/limites/categorias',       clause: '5.2', label: 'Categorías de emisión',    desc: 'Las 6 categorías ISO 14064-1 y su inclusión' },
    ],
  },
  {
    slug: 'cuantificacion', n: 6, label: '6 · Cuantificación', href: '/cuantificacion', icon: Calculator,
    items: [
      { href: '/cuantificacion/inventario', clause: '6.1', label: 'Inventario de emisiones', desc: 'Registro de datos de actividad y cálculo de t CO₂eq' },
      { href: '/cuantificacion/fuentes',    clause: '6.3', label: 'Fuentes de emisión',      desc: 'Catálogo de fuentes por categoría y tipo de sitio' },
      { href: '/cuantificacion/factores',   clause: '6.5', label: 'Factores de emisión',     desc: 'Factores de referencia (kg CO₂eq / unidad)' },
      { href: '/cuantificacion/ano-base',   clause: '6.4', label: 'Año base',                desc: 'Año base del inventario y política de recálculo' },
    ],
  },
  {
    slug: 'mitigacion', n: 7, label: '7 · Mitigación', href: '/mitigacion', icon: TrendingDown,
    items: [
      { href: '/mitigacion/objetivos', clause: '7.x', label: 'Objetivos de reducción', desc: 'Metas de reducción de emisiones y su seguimiento' },
      { href: '/mitigacion/proyectos', clause: '7.x', label: 'Proyectos de reducción', desc: 'Iniciativas de reducción y remoción de GEI' },
    ],
  },
  {
    slug: 'gestion-datos', n: 8, label: '8 · Gestión de datos', href: '/gestion-datos', icon: Database,
    items: [
      { href: '/gestion-datos/evidencias',       clause: '8.x', label: 'Evidencias',         desc: 'Facturas, remitos y registros de respaldo' },
      { href: '/gestion-datos/control-calidad',  clause: '8.x', label: 'Control de calidad',  desc: 'Verificación de datos e incertidumbre' },
      { href: '/gestion-datos/documentos',       clause: '8.x', label: 'Documentación',       desc: 'Procedimientos y documentos del sistema GEI' },
      { href: '/gestion-datos/responsables',     clause: '8.x', label: 'Responsables',        desc: 'Directorio de personas y responsables' },
    ],
  },
  {
    slug: 'reporte', n: 9, label: '9 · Reporte', href: '/reporte', icon: BarChart3,
    items: [
      { href: '/reporte/consolidado', clause: '9.x', label: 'Consolidado de emisiones', desc: 'Totales por categoría, trimestre y sitio' },
      { href: '/reporte/indicadores', clause: '9.x', label: 'Indicadores de intensidad', desc: 'Emisiones por unidad de producto / servicio' },
      { href: '/reporte/informe',     clause: '9.x', label: 'Informe de huella',        desc: 'Declaración anual de GEI' },
    ],
  },
  {
    slug: 'verificacion', n: 'V', label: 'Verificación', href: '/verificacion', icon: ShieldCheck,
    items: [
      { href: '/verificacion/verificaciones',   clause: '14064-3', label: 'Verificaciones',   desc: 'Auditorías del inventario y hallazgos' },
      { href: '/verificacion/no-conformidades', clause: '—',       label: 'No conformidades',  desc: 'NC, observaciones y acciones correctivas' },
    ],
  },
  {
    slug: 'cbam', n: '€', label: 'CBAM', href: '/cbam', icon: Globe,
    items: [
      { href: '/cbam/instalaciones', clause: 'CBAM', label: 'Instalaciones',          desc: 'Instalaciones productoras (operadores)' },
      { href: '/cbam/bienes',        clause: 'CBAM', label: 'Bienes CBAM',            desc: 'Catálogo por código CN y categoría agregada' },
      { href: '/cbam/declaraciones', clause: 'CBAM', label: 'Emisiones incorporadas', desc: 'Cálculo de emisiones incorporadas por bien y período' },
      { href: '/cbam/reporte',       clause: 'CBAM', label: 'Reporte CBAM',           desc: 'Resumen por bien/CN para el communication template UE' },
    ],
  },
]

export const NAV_GROUP_BY_SLUG: Record<string, NavGroup> =
  Object.fromEntries(NAV_GROUPS.map(g => [g.slug, g]))
