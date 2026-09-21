import * as React from 'react'

import { SectionHeading } from '@/components/ui'
import { cn } from '@/lib/utils'

/**
 * The style guide's own chrome.
 *
 * None of it ships in the product. It exists so every specimen is framed the
 * same way and so the page itself still reads as the design system rather than
 * as a test harness — a style guide that looks generic has already failed.
 */

/* -------------------------------------------------------------------------- */
/* Section                                                                     */
/* -------------------------------------------------------------------------- */

export interface SectionProps {
  id: string
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}

/**
 * One anchored block. Separation between sections is air, not a rule: the
 * hairline that draws itself in under the heading is the only line a section
 * gets, and `py-16` does the rest.
 */
export function Section({ id, eyebrow, title, description, action, children }: SectionProps) {
  return (
    // scroll-mt clears the sticky header when the side nav jumps here.
    <section id={id} className="scroll-mt-28 py-16 first:pt-10">
      <SectionHeading eyebrow={eyebrow} title={title} description={description} action={action} />
      <div className="mt-10">{children}</div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Panel                                                                       */
/* -------------------------------------------------------------------------- */

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string
  /** Right-aligned mono annotation — the class being forced, a caveat, a unit. */
  note?: string
  /** Drops the inner padding, for content that brings its own. */
  flush?: boolean
}

/** A captioned specimen box: surface ground, one hairline, no shadow. */
export function Panel({ label, note, flush = false, className, children, ...props }: PanelProps) {
  return (
    <div className={cn('rounded-card border border-line bg-bg-800', className)} {...props}>
      {label || note ? (
        <div className="flex items-baseline justify-between gap-4 border-b border-line px-5 py-3">
          {label ? <span className="text-micro uppercase text-text-tertiary">{label}</span> : null}
          {note ? (
            <code className="min-w-0 truncate font-mono text-xs text-text-tertiary/70">{note}</code>
          ) : null}
        </div>
      ) : null}
      <div className={flush ? undefined : 'p-5'}>{children}</div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Specimen                                                                    */
/* -------------------------------------------------------------------------- */

export interface SpecimenProps {
  label: string
  /** Column layout, for controls that want the full width of the cell. */
  stack?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * A labelled cell in a state matrix. The label is a micro caps eyebrow, so a
 * grid of these reads as one strip of annotation above the specimens.
 */
export function Specimen({ label, stack = false, className, children }: SpecimenProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)}>
      <span className="text-micro uppercase text-text-tertiary">{label}</span>
      {/* min-h keeps a row of cells aligned when one holds nothing taller than a
          badge and its neighbour holds a 40px control. */}
      <div className={cn('flex min-h-10 gap-3', stack ? 'flex-col' : 'flex-wrap items-center')}>
        {children}
      </div>
    </div>
  )
}

const gridColumns = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
  5: 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5',
} as const

export interface SpecimenGridProps {
  columns?: keyof typeof gridColumns
  className?: string
  children: React.ReactNode
}

export function SpecimenGrid({ columns = 3, className, children }: SpecimenGridProps) {
  return <div className={cn('grid gap-6', gridColumns[columns], className)}>{children}</div>
}

/* -------------------------------------------------------------------------- */
/* Swatch                                                                      */
/* -------------------------------------------------------------------------- */

export interface SwatchProps {
  /** The token as it is written in tokens.css. */
  name: string
  /** The utility that paints it — `bg-accent`, `bg-ok-surface`. */
  className: string
  note?: string
}

export function Swatch({ name, className, note }: SwatchProps) {
  return (
    <div className="flex items-center gap-3">
      {/* line-strong rather than line: several of these swatches *are* the
          panel's own ground, and a whisper hairline would lose them entirely. */}
      <span
        aria-hidden="true"
        className={cn('size-10 shrink-0 rounded-xs border border-line-strong', className)}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <code className="truncate font-mono text-xs text-text-secondary">{name}</code>
        {note ? <span className="truncate text-micro uppercase text-text-tertiary">{note}</span> : null}
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Side navigation                                                             */
/* -------------------------------------------------------------------------- */

export interface NavItem {
  id: string
  label: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * Which section is currently under the top of the viewport.
 *
 * The observed band is a thin strip below the sticky header rather than the
 * whole viewport, so "current" means the section being read, not every section
 * that happens to be on screen. First in document order wins, which stops the
 * marker jumping backwards on a fast scroll.
 */
export function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = React.useState<string | null>(ids[0] ?? null)
  // The array is rebuilt on every render at the call site; the joined key is
  // what actually decides whether the observer has to be rewired.
  const key = ids.join('|')

  React.useEffect(() => {
    const order = key.split('|')
    const visible = new Set<string>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        // Between two sections nothing is in the band — hold the last one rather
        // than dropping the marker into nowhere.
        setActive((previous) => order.find((id) => visible.has(id)) ?? previous)
      },
      { rootMargin: '-96px 0px -66% 0px' },
    )

    for (const id of order) {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [key])

  return active
}

export interface SectionNavProps {
  groups: readonly NavGroup[]
  activeId: string | null
  className?: string
}

/**
 * The sticky index. Every entry is an 11px wide-tracked label preceded by a
 * tick; the active one's tick lengthens and turns accent. That is the whole
 * affordance — a filled pill behind the current item would put a second
 * emphasis on a page whose only job is to be looked at.
 */
export function SectionNav({ groups, activeId, className }: SectionNavProps) {
  return (
    <nav aria-label="Style guide sections" className={cn('hidden w-48 shrink-0 xl:block', className)}>
      <div className="sticky top-24 flex max-h-[calc(100vh-8rem)] flex-col gap-7 overflow-y-auto pb-8">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <span className="text-micro uppercase text-text-tertiary/50">{group.label}</span>
            <ul className="flex flex-col">
              {group.items.map((item) => {
                const active = item.id === activeId
                return (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'group flex items-center gap-3 rounded-xs py-1.5 text-micro uppercase transition-colors',
                        active ? 'text-text-primary' : 'text-text-tertiary hover:text-text-secondary',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'h-px shrink-0 transition-[width,background-color] duration-200 ease-out',
                          active ? 'w-6 bg-accent' : 'w-3 bg-line-strong group-hover:w-4',
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}

/* -------------------------------------------------------------------------- */
/* ThemeSplit                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Every token the paired panes need in order to repaint themselves in the theme
 * they are not currently in. Built from the ramp suffixes, so a new state tone
 * is one string away from being covered.
 */
const THEME_TOKENS = [
  'bg-900',
  'bg-800',
  'bg-700',
  'bg-600',
  'line',
  'line-strong',
  'text-primary',
  'text-secondary',
  'text-tertiary',
  'text-inverse',
  'accent',
  'accent-ink',
  'accent-contrast',
  'ring',
  ...['ok', 'warn', 'fault', 'info', 'neutral'].flatMap((tone) => [
    tone,
    `${tone}-surface`,
    `${tone}-line`,
    `${tone}-ink`,
  ]),
]

type TokenVars = React.CSSProperties

function readTokenVars(source: Element): TokenVars {
  const computed = getComputedStyle(source)
  const vars: Record<string, string> = {}
  for (const name of THEME_TOKENS) vars[`--${name}`] = computed.getPropertyValue(`--${name}`).trim()
  return vars as TokenVars
}

/**
 * Lifts both themes' token values off the live stylesheet.
 *
 * Dark reads from a throwaway probe carrying the same preference classes as the
 * root, so the page itself is never touched. Light has no class of its own — it
 * *is* the absence of `.dark` — so it can only be read from the root, with the
 * class off for the length of one synchronous read. Nothing paints in between,
 * and hardcoding the values here instead would put a second source of truth
 * next to tokens.css.
 */
function readThemeTokenSets(): { light: TokenVars; dark: TokenVars } {
  const root = document.documentElement

  const probe = document.createElement('div')
  probe.className = `${root.className} dark`
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'
  document.body.appendChild(probe)
  const dark = readTokenVars(probe)
  probe.remove()

  const wasDark = root.classList.contains('dark')
  if (wasDark) root.classList.remove('dark')
  const light = readTokenVars(root)
  if (wasDark) root.classList.add('dark')

  return { light, dark }
}

function useThemeTokenSets() {
  const [sets, setSets] = React.useState<{ light: TokenVars; dark: TokenVars } | null>(null)

  React.useLayoutEffect(() => {
    const root = document.documentElement
    let observer: MutationObserver | null = null

    // The read toggles `.dark` on the root, which would re-trigger the observer
    // forever — so it stops watching for the length of its own mutation.
    const read = () => {
      observer?.disconnect()
      setSets(readThemeTokenSets())
      observer?.observe(root, { attributes: true, attributeFilter: ['class'] })
    }

    // High contrast rewrites the hairlines and the secondary ink, so the panes
    // have to follow every preference change, not only the theme.
    observer = new MutationObserver(read)
    read()
    return () => observer?.disconnect()
  }, [])

  return sets
}

function ThemePane({
  label,
  vars,
  children,
}: {
  label: string
  vars: TokenVars | undefined
  children: React.ReactNode
}) {
  return (
    <div style={vars} className="overflow-hidden rounded-card border border-line bg-bg-900 text-text-primary">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
        <span className="text-micro uppercase text-text-tertiary">{label}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export interface ThemeSplitProps {
  children: React.ReactNode
  className?: string
}

/**
 * Renders the same specimen twice, once per theme, by overriding the token
 * variables on each pane. The children are a single element tree used in both
 * places — nothing inside knows which theme it landed in, which is precisely
 * the thing being demonstrated.
 *
 * Until the token sets are read (one layout effect) both panes inherit the page
 * theme, so there is never a flash of unstyled swatch.
 */
export function ThemeSplit({ children, className }: ThemeSplitProps) {
  const sets = useThemeTokenSets()

  return (
    <div className={cn('grid gap-4 md:grid-cols-2', className)}>
      <ThemePane label="Light" vars={sets?.light}>
        {children}
      </ThemePane>
      <ThemePane label="Dark" vars={sets?.dark}>
        {children}
      </ThemePane>
    </div>
  )
}
