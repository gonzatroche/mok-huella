'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { NAV_GROUP_BY_SLUG } from '@/lib/nav'
import { CHAPTER_BY_SLUG } from '@/lib/sig'

// Landing de un capítulo: encabezado + tarjetas a cada submódulo.
export default function ChapterLanding({ slug }: { slug: string }) {
  const group = NAV_GROUP_BY_SLUG[slug]
  const chapter = CHAPTER_BY_SLUG[slug]
  if (!group || !chapter) return null
  const Icon = group.icon

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${chapter.color}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400">{typeof chapter.n === 'number' ? `Cláusula ${chapter.n} · ` : ''}ISO 14064-1:2018</p>
            <h1 className="page-title">{chapter.title}</h1>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-1">{chapter.desc}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {group.items.map(i => (
          <Link key={i.href} href={i.href}
            className="card hover:shadow-md hover:border-teal-100 transition-all flex items-start gap-3 group">
            <span className="text-xs font-bold text-teal-600 bg-teal-50 rounded-lg px-2 py-1 flex-shrink-0">{i.clause}</span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-gray-900">{i.label}</div>
              {i.desc && <div className="text-xs text-gray-500 mt-0.5">{i.desc}</div>}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-teal-500 flex-shrink-0 mt-1" />
          </Link>
        ))}
      </div>
    </>
  )
}
