import { cn } from '@/lib/utils'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps {
  label?: string
  image?: string
  size?: AvatarSize
  className?: string
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
  xl: 'h-12 w-12 text-lg',
}

function getInitials(label: string): string {
  return label
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function getColor(label: string): string {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700',
    'bg-yellow-100 text-yellow-700',
    'bg-pink-100 text-pink-700',
    'bg-indigo-100 text-indigo-700',
  ]
  const idx = label.charCodeAt(0) % colors.length
  return colors[idx]
}

export default function Avatar({ label = '', image, size = 'md', className }: AvatarProps) {
  if (image) {
    return (
      <img
        src={image}
        alt={label}
        className={cn('rounded-full object-cover flex-shrink-0', sizeClasses[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-medium flex-shrink-0',
        sizeClasses[size],
        getColor(label),
        className
      )}
      title={label}
    >
      {getInitials(label) || '?'}
    </div>
  )
}
