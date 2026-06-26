'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Logo de la organización. Lee `logo_url` / `org_name` de org_settings.
 * Si no hay logo, muestra un recuadro con las iniciales (o "SGC").
 * `size` = alto en px.
 */
export default function Logo({ size = 28, rounded = 'rounded-lg', withName = false }: { size?: number; rounded?: string; withName?: boolean }) {
  const [logo, setLogo] = useState<string | null>(null)
  const [name, setName] = useState<string>('SGC')
  const [imgOk, setImgOk] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('org_settings').select('org_name, logo_url').eq('id', 1).single().then(({ data }) => {
      if (data?.logo_url) setLogo(data.logo_url)
      if (data?.org_name) setName(data.org_name)
    })
  }, [])

  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase() || 'SGC'

  const mark = (logo && imgOk) ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt={name} onError={() => setImgOk(false)} style={{ height: size, width: 'auto', objectFit: 'contain' }} />
  ) : (
    <div className={`bg-teal-600 ${rounded} flex items-center justify-center`} style={{ width: size, height: size }}>
      <span className="text-white font-bold" style={{ fontSize: size * 0.36 }}>{initials}</span>
    </div>
  )

  if (!withName) return mark
  return <span className="flex items-center gap-2">{mark}<span className="font-semibold text-gray-700">{name}</span></span>
}
