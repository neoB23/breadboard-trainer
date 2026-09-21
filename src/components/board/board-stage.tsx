import * as React from 'react'

import { cn } from '@/lib/utils'

import { Breadboard } from './breadboard'
import type { NetId } from './geometry'
import { useOnScreen } from './use-board-sequence'

/**
 * Chooses between the flat board and the 3D one, and keeps the 3D engine out of
 * the entry bundle.
 *
 * ---------------------------------------------------------------------------
 * THE FALLBACK IS THE REAL COMPONENT
 *
 * `React.lazy` usually gets a spinner for its Suspense fallback. Here it gets the
 * SVG board — the same circuit, the same nets, already interactive. So the page
 * is never showing a placeholder: it shows a correct, usable board immediately
 * and swaps in the three-dimensional one when the chunk lands.
 *
 * That ordering also means the 3D scene is a genuine progressive enhancement. A
 * browser with no WebGL, a chunk that fails to download, a device that would
 * struggle with it — every one of those cases degrades to a board that works,
 * rather than to a blank rectangle.
 * ---------------------------------------------------------------------------
 */
const Board3D = React.lazy(() => import('./board-3d'))

export interface BoardStageProps {
  litNets?: readonly NetId[]
  focusedNet?: NetId | null
  faultedNet?: NetId | null
  scan?: number | null
  placed?: number
  fault?: boolean
  onNetSelect?: (net: NetId) => void
  title?: string
  /**
   * Render in 3D. Off by default so the plain `Breadboard` stays the thing most
   * callers get — the auth aside and the styleguide specimens do not want a
   * WebGL context each.
   */
  dimensional?: boolean
  className?: string
}

export function BoardStage({
  litNets = [],
  focusedNet = null,
  faultedNet = null,
  scan = null,
  placed = 3,
  fault = false,
  onNetSelect,
  title,
  dimensional = false,
  className,
}: BoardStageProps) {
  const hostRef = React.useRef<HTMLDivElement>(null)
  const onScreen = useOnScreen(hostRef)

  /**
   * The chunk is not even requested until the board has been on screen once.
   *
   * Sticky rather than tracking visibility, because unmounting the canvas on
   * scroll would tear down and rebuild a WebGL context every time somebody
   * scrolled past — which is far more expensive than leaving it be.
   */
  const [everSeen, setEverSeen] = React.useState(false)
  React.useEffect(() => {
    if (onScreen) setEverSeen(true)
  }, [onScreen])

  const flat = (
    <Breadboard
      placed={placed}
      litNets={litNets}
      focusedNet={focusedNet}
      faultedNet={faultedNet}
      scan={scan}
      fault={fault}
      onNetSelect={onNetSelect}
      title={title}
    />
  )

  if (!dimensional || !everSeen) {
    return (
      <div ref={hostRef} className={className}>
        {flat}
      </div>
    )
  }

  return (
    <div ref={hostRef} className={cn('relative', className)}>
      {/*
        A fixed aspect box. The canvas has no intrinsic size, so without this the
        card would collapse to nothing on the frame the 3D board takes over and
        the whole hero would jump.
      */}
      <div className="aspect-[16/10] w-full">
        <React.Suspense fallback={<div className="flex size-full items-center justify-center">{flat}</div>}>
          <Board3D
            litNets={litNets}
            faultedNet={faultedNet}
            fault={fault}
            placed={placed}
            className="size-full"
          />
        </React.Suspense>
      </div>

      {/* The drawing is decorative once it is a scene — the netlist beside it
          says everything it says, in words. */}
      {title ? <span className="sr-only">{title}</span> : null}
    </div>
  )
}
