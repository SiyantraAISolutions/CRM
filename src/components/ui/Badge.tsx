import { cn } from '@/lib/utils'

type BadgeVariant = 'green' | 'red' | 'orange' | 'blue' | 'gray' | 'subtle'

interface BadgeProps {
  label: string
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  green: 'badge-green',
  red: 'badge-red',
  orange: 'badge-orange',
  blue: 'badge-blue',
  gray: 'badge-gray',
  subtle: 'bg-surface-gray-2 text-ink-gray-7',
}

export default function Badge({ label, variant = 'gray', className }: BadgeProps) {
  return (
    <span className={cn('badge', variantClasses[variant], className)}>
      {label}
    </span>
  )
}
