import type { KeyboardEvent } from 'react'

// Makes a non-button element (a card, a row) behave like a button:
// clickable, reachable with Tab, and triggered with Enter or Space.
export function pressable(onPress: () => void, label?: string) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': label,
    onClick: onPress,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onPress()
      }
    },
  }
}

// Smoothly scrolls to a page section by its id.
export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Stops a click on an inner control (a select, a small button) from also
// triggering the clickable card around it.
export function stopPropagation(event: { stopPropagation: () => void }) {
  event.stopPropagation()
}
