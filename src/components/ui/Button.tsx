import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../utils/format'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'dangerGhost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  dangerGhost: 'text-red-600 hover:bg-red-50 hover:text-red-700',
}

// One button style for the whole app. Extra props (onClick, type...) pass straight through.
export default function Button({ variant = 'primary', loading = false, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        variantStyles[variant],
        className,
      )}
    >
      {loading ? 'Please wait…' : children}
    </button>
  )
}
