import { cn } from '@/lib/utils'

interface LayoutHeaderProps {
  left?: React.ReactNode
  right?: React.ReactNode
  className?: string
}

export default function LayoutHeader({ left, right, className }: LayoutHeaderProps) {
  return (
    <div className={cn('layout-header', className)}>
      <div className="flex items-center gap-2">{left}</div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  )
}
