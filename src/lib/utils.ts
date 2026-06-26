import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Trae TODAS las filas de una consulta Supabase paginando (supera el tope de 1000).
export async function fetchAll<T = any>(makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = []
  let from = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await makeQuery(from, from + 999)
    if (error || !data) break
    out.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return out
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return '—'
  let d: Date
  if (typeof date === 'string') {
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(date)
  } else {
    d = date
  }
  return new Intl.DateTimeFormat('es', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d)
}

// Fecha local YYYY-MM-DD (sin corrimientos por zona horaria)
export function localDateStr(d: Date = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ¿Falta poco / ya venció una fecha objetivo?
export function dueState(due: string | null | undefined): 'ok' | 'soon' | 'overdue' | null {
  if (!due) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(due); d.setHours(0, 0, 0, 0)
  const diff = (d.getTime() - today.getTime()) / 86400000
  if (diff < 0) return 'overdue'
  if (diff <= 7) return 'soon'
  return 'ok'
}

// ¿El error de Supabase/Postgres es por violar un índice/constraint único?
export function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '23505' || /duplicate key|unique constraint|already exists/i.test(error.message ?? '')
}

export function friendlyError(
  error: { code?: string; message?: string } | null,
  fields: [RegExp, string][] = [],
  fallbackDup = 'Ya existe un registro con ese valor (debe ser único).',
): string {
  if (!error) return ''
  if (isUniqueViolation(error)) {
    for (const [re, msg] of fields) if (re.test(error.message ?? '')) return msg
    return fallbackDup
  }
  return 'Error: ' + (error.message ?? 'desconocido')
}
