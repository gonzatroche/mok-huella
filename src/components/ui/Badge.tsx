import { cn } from '@/lib/utils'

export function Badge({ color, children, className }: {
  color?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn('badge', color ?? 'bg-gray-100 text-gray-700', className)}>
      {children}
    </span>
  )
}

// Píldora para una etiqueta tomada de un diccionario {label, color}
export function StatusBadge({ map, value, className }: {
  map: Record<string, { label: string; color: string }>
  value: string | null | undefined
  className?: string
}) {
  const entry = value ? map[value] : undefined
  return (
    <Badge color={entry?.color} className={className}>
      {entry?.label ?? value ?? '—'}
    </Badge>
  )
}
