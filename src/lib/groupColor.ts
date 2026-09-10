/** Tailwind classes per calendar group so chips, legend and map pins read as one system. */
export interface GroupStyle {
  chip: string
  dot: string
  /** Hex for the Leaflet map, which cannot use Tailwind classes. */
  hex: string
}

const STYLES: Record<string, GroupStyle> = {
  'Drop-in': {
    chip: 'bg-sky-100 text-sky-900 hover:bg-sky-200 dark:bg-sky-950 dark:text-sky-100 dark:hover:bg-sky-900',
    dot: 'bg-sky-500',
    hex: '#0ea5e9',
  },
  Fitness: {
    chip: 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-900',
    dot: 'bg-emerald-500',
    hex: '#10b981',
  },
  Sports: {
    chip: 'bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-orange-950 dark:text-orange-100 dark:hover:bg-orange-900',
    dot: 'bg-orange-500',
    hex: '#f97316',
  },
  'Art & Culture': {
    chip: 'bg-violet-100 text-violet-900 hover:bg-violet-200 dark:bg-violet-950 dark:text-violet-100 dark:hover:bg-violet-900',
    dot: 'bg-violet-500',
    hex: '#8b5cf6',
  },
}

const FALLBACK: GroupStyle = {
  chip: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
  dot: 'bg-zinc-500',
  hex: '#71717a',
}

export function groupStyle(group: string): GroupStyle {
  return STYLES[group] ?? FALLBACK
}
