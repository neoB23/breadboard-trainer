import * as React from 'react'

import { cn } from '@/lib/utils'

import { useFieldContext } from './field'

export interface SegmentedOption<T extends string> {
  value: T
  label: React.ReactNode
  /** Small qualifier under the label — used by the theme picker. */
  hint?: string
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onValueChange: (value: T) => void
  /** Names the group for assistive tech when no `<Field>` wraps it. */
  label?: string
  className?: string
  /** Stretches each segment to an equal share of the width. */
  fill?: boolean
}

/**
 * A choice between two or three options, laid out as one pill split into
 * segments.
 *
 * Used for the role selector on `/register`, the language toggle and the theme
 * picker. All three are choices a person makes once and then recognises — a
 * `<Select>` would hide the alternatives behind a click, and radio buttons would
 * put four separate controls where the system's shape language says one control.
 *
 * ---------------------------------------------------------------------------
 * SEMANTICS
 *
 * A `radiogroup` of `radio` buttons, not a row of toggles: exactly one is
 * selected and choosing another deselects the first, which is what `radio`
 * means and what `aria-pressed` does not.
 *
 * Arrow keys move between segments and roving `tabIndex` keeps the group a
 * single tab stop — the behaviour a radio group has natively and that any
 * div-based implementation has to put back by hand.
 *
 * Selection is not colour alone: the chosen segment takes the accent *fill*, so
 * it differs in shape and weight as well as hue, and `aria-checked` carries it
 * to a screen reader.
 * ---------------------------------------------------------------------------
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  label,
  className,
  fill = false,
}: SegmentedControlProps<T>) {
  const field = useFieldContext()
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])

  const move = (from: number, delta: number) => {
    const enabled = options
      .map((option, index) => ({ option, index }))
      .filter((entry) => !entry.option.disabled)
    if (enabled.length === 0) return

    const position = enabled.findIndex((entry) => entry.index === from)
    const next = enabled[(position + delta + enabled.length) % enabled.length]
    if (!next) return

    onValueChange(next.option.value)
    refs.current[next.index]?.focus()
  }

  const selectedIndex = options.findIndex((option) => option.value === value)

  return (
    <div
      role="radiogroup"
      aria-label={label}
      id={field?.controlId}
      aria-describedby={field?.describedBy}
      className={cn(
        // The container is the pill; the segments inside take the same radius so
        // the selected one nests cleanly at either end.
        'inline-flex gap-1 rounded-pill border border-line bg-bg-800 p-1',
        // A <Field> lays its children out in a flex column, which stretches them
        // — without this the two-option theme picker spans the whole form.
        fill ? 'flex w-full' : 'w-fit self-start',
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value

        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            // One tab stop for the whole group; arrows move within it.
            tabIndex={selected || (selectedIndex === -1 && index === 0) ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault()
                move(index, 1)
              }
              if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault()
                move(index, -1)
              }
            }}
            className={cn(
              'flex min-w-0 flex-col items-center justify-center rounded-pill px-4 py-1.5 text-sm',
              'transition-colors duration-200 ease-out',
              'disabled:pointer-events-none disabled:opacity-50',
              fill && 'flex-1',
              selected
                ? 'bg-accent font-medium text-accent-contrast'
                : 'text-text-secondary hover:bg-bg-700 hover:text-text-primary',
            )}
          >
            <span className="truncate">{option.label}</span>
            {option.hint ? (
              <span
                className={cn(
                  'truncate text-[0.625rem] uppercase tracking-wider',
                  selected ? 'text-accent-contrast/70' : 'text-text-tertiary',
                )}
              >
                {option.hint}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
