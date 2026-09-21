import { cn } from '@/lib/utils'

/**
 * The faint drafting grid behind the light sections of the landing page.
 *
 * The page below the hero was three white blocks in a row with nothing holding
 * them apart, which reads as unfinished rather than as restrained. This is the
 * cheapest honest fix: a 0.1in grid — the pitch of the board the whole product
 * is about — at an opacity you notice only once you look for it.
 *
 * A pattern rather than a picture, for the same reasons the hero backdrop is:
 * no asset, no licence, follows the tokens, and it cannot fight the text over it
 * because it is two per cent of a hairline.
 *
 * Uses a `<pattern>` rather than a repeating CSS gradient so the cell size is
 * expressed once and stays square at every viewport.
 */

export interface BlueprintBackdropProps {
  /** Cell size in px. The default is the board's own pitch. */
  cell?: number
  /** Fades the grid out toward the bottom, so a section ends rather than stops. */
  fade?: 'none' | 'bottom' | 'both'
  className?: string
}

export function BlueprintBackdrop({ cell = 24, fade = 'both', className }: BlueprintBackdropProps) {
  // Unique per instance: two grids on one page with the same pattern id would
  // have the second silently reuse the first's cell size.
  const id = `blueprint-${cell}`

  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <svg className="size-full">
        <defs>
          <pattern id={id} width={cell} height={cell} patternUnits="userSpaceOnUse">
            {/* Two hairlines per cell rather than a stroked rect: a rect would
                double the line weight where cells meet. */}
            <path
              d={`M ${cell} 0 L 0 0 0 ${cell}`}
              fill="none"
              className="stroke-text-primary"
              strokeWidth={1}
              opacity={0.045}
            />
          </pattern>

          {fade === 'none' ? null : (
            <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity={fade === 'both' ? 0 : 1} />
              <stop offset="28%" stopColor="white" stopOpacity={1} />
              <stop offset="72%" stopColor="white" stopOpacity={1} />
              <stop offset="100%" stopColor="white" stopOpacity={0} />
            </linearGradient>
          )}

          {fade === 'none' ? null : (
            <mask id={`${id}-mask`}>
              <rect width="100%" height="100%" fill={`url(#${id}-fade)`} />
            </mask>
          )}
        </defs>

        <rect
          width="100%"
          height="100%"
          fill={`url(#${id})`}
          {...(fade === 'none' ? {} : { mask: `url(#${id}-mask)` })}
        />
      </svg>
    </div>
  )
}
