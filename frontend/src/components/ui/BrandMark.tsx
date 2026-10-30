import { cn } from '../../utils/format'
import Icon from './Icon'

// The app's logo tile.
export default function BrandMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-sm shadow-indigo-600/30',
        className,
      )}
    >
      <Icon name="logo" className="h-[55%] w-[55%]" strokeWidth={2.25} />
    </span>
  )
}
