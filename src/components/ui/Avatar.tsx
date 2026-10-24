import { initials } from '../../utils/format'

// A small circle with someone's initials.
export default function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs'
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-800 ${sizeClass}`}
    >
      {initials(name)}
    </span>
  )
}
