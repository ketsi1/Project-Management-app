import { initials } from '../../utils/format'

// Colorful gradient avatars — color derived from name hash for consistency.
const GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-fuchsia-500 to-violet-600',
  'from-sky-500 to-cyan-600',
]

function getGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]
}

export default function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass =
    size === 'sm' ? 'h-6 w-6 text-[9px]' :
    size === 'lg' ? 'h-10 w-10 text-sm' :
    'h-8 w-8 text-xs'

  const gradient = getGradient(name)

  return (
    <span
      title={name}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white shadow-sm ring-2 ring-white ${gradient} ${sizeClass}`}
    >
      {initials(name)}
    </span>
  )
}
