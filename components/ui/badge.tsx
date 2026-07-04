import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-brand text-white',
        secondary: 'border-transparent bg-gray-100 text-gray-900',
        destructive: 'border-transparent bg-red-500 text-white',
        outline: 'text-foreground',
        active: 'border-transparent bg-green-100 text-green-800',
        hold: 'border-transparent bg-amber-100 text-amber-800',
        cancelled: 'border-transparent bg-red-100 text-red-800',
        prospect: 'border-transparent bg-blue-100 text-blue-800',
        completed: 'border-transparent bg-gray-100 text-gray-800',
        onboarding: 'border-transparent bg-purple-100 text-purple-800',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
