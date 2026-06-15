import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export default function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav className={cn('flex items-center gap-1.5 text-sm', className)}>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-ink-gray-4" />}
          {item.href && i < items.length - 1 ? (
            <Link
              href={item.href}
              className="font-medium text-ink-gray-5 hover:text-ink-gray-7 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className={cn('font-semibold', i === items.length - 1 ? 'text-ink-gray-9' : 'text-ink-gray-5')}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  )
}
