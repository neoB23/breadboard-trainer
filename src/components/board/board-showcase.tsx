import { CircleCheck, OctagonX, Play, ScanLine, Wrench } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

import { BoardStage } from './board-stage'
import { BUILD_TOTAL, NETS, type NetId } from './geometry'
import { useBoardSequence, useOnScreen } from './use-board-sequence'

/**
 * The landing hero's centrepiece: a board that builds itself, gets scanned, and
 * is read out as a netlist — with one net missing.
 *
 * ---------------------------------------------------------------------------
 * WHY THE MOTION IS ALLOWED TO BE HERE AT ALL
 *
 * The brief is blunt about this: nothing moves that the reader did not ask for,
 * and a change that makes the app more distinctive at the cost of legibility is
 * the wrong change. A decorative animation on a teaching tool's front page would
 * fail both tests.
 *
 * This one earns its place because it *is* the explanation. The product's whole
 * premise — five holes are one node, the channel splits them, and a jumper on
 * the wrong side turns one net into two — takes three paragraphs to write and
 * about nine seconds to watch. The four numbered steps further down the page say
 * the same thing in prose for anyone who would rather read it.
 *
 * Three things keep it honest:
 *   - it stops entirely under `.reduce-motion` and shows the finished board;
 *   - it stops when scrolled out of view, rather than looping at somebody;
 *   - it never moves anything under the cursor, and the netlist rows are real
 *     controls — clicking one lights that net on the board.
 * ---------------------------------------------------------------------------
 */

export interface BoardShowcaseProps {
  className?: string
}

export function BoardShowcase({ className }: BoardShowcaseProps) {
  const t = useT()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const onScreen = useOnScreen(containerRef)

  const { placed, placing, found, scan, diagnosed, still, replay } = useBoardSequence({
    paused: !onScreen,
  })

  /**
   * What the pointer or keyboard is inspecting, which overrides the sequence's
   * own highlight. Null means "whatever the sequence is doing".
   */
  const [inspected, setInspected] = React.useState<NetId | null>(null)

  // A net the sequence has not found yet cannot be inspected — selecting one
  // would show a highlight for a row that is still blank.
  const focused = inspected && found.includes(inspected) ? inspected : null

  /**
   * The status line names the part going in, not just the phase.
   *
   * "Building the circuit" for three seconds tells a first-time visitor nothing
   * about what they are looking at. "Seating the 220 ohm resistor" while the
   * resistor visibly goes into the board is the caption that turns the animation
   * into an explanation — which is the only reason it is allowed to be here.
   */
  const stageLabel = diagnosed
    ? t('board.stage.diagnosed')
    : scan !== null
      ? t('board.stage.scanning')
      : found.length > 0
        ? t('board.stage.reading')
        : placing
          ? t(`board.placing.${placing}` as const)
          : placed >= BUILD_TOTAL
            ? t('board.stage.ready')
            : t('board.stage.building')

  return (
    <div ref={containerRef} className={cn('overflow-hidden rounded-card bg-bg-800 shadow-lg', className)}>
      {/* ---- the board ------------------------------------------------------ */}
      <div className="border-b border-line bg-bg-900 px-3 py-3">
        <BoardStage
          dimensional
          placed={placed}
          litNets={found}
          focusedNet={focused}
          scan={scan}
          fault
          faultedNet={diagnosed ? 'n3' : null}
          onNetSelect={(net) => setInspected((current) => (current === net ? null : net))}
          title={t('board.alt')}
        />
      </div>

      {/* ---- what the scan produced ----------------------------------------- */}
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
        <span className="flex items-center gap-2 text-xs font-medium text-text-secondary">
          {/* The icon says which of the two states this is without relying on
              the word, and neither is carried by colour alone. */}
          {diagnosed ? (
            <OctagonX aria-hidden="true" className="size-4 text-fault" />
          ) : placing ? (
            <Wrench aria-hidden="true" className="size-4 text-accent" />
          ) : (
            <ScanLine aria-hidden="true" className="size-4 text-accent" />
          )}
          <span aria-live="polite">{stageLabel}</span>
        </span>

        {still ? (
          <span className="text-xs text-text-tertiary">{t('board.still')}</span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setInspected(null)
              replay()
            }}
          >
            <Play aria-hidden="true" />
            {t('board.replay')}
          </Button>
        )}
      </div>

      <ul className="px-2 py-2">
        {NETS.map((net) => {
          const revealed = found.includes(net.id)
          const broken = net.faultable === true && diagnosed
          const Icon = broken ? OctagonX : CircleCheck

          return (
            <li key={net.id}>
              <button
                type="button"
                // Disabled until the scan has found it: a row that lights a net
                // the board is not showing yet would be a lie.
                disabled={!revealed}
                onClick={() => setInspected((current) => (current === net.id ? null : net.id))}
                onPointerEnter={() => revealed && setInspected(net.id)}
                onPointerLeave={() => setInspected(null)}
                aria-pressed={focused === net.id}
                className={cn(
                  'flex w-full items-center gap-3 rounded-card px-3 py-2.5 text-left font-mono text-xs',
                  'transition-colors duration-200 ease-out',
                  'disabled:cursor-default',
                  focused === net.id ? 'bg-accent/10' : revealed ? 'hover:bg-bg-900' : undefined,
                )}
              >
                {/*
                  A row that has not been found yet is a *placeholder*, not an
                  invisible one. The space has to be reserved either way — a list
                  that grows by three rows shoves the diagnosis down the page
                  mid-read — and an empty reserved space reads as a broken panel.
                  Showing the shape of what is coming reads as a machine working.
                */}
                {revealed ? (
                  <>
                    <Icon
                      aria-hidden="true"
                      className={cn('size-4 shrink-0', broken ? 'text-fault' : 'text-ok')}
                    />
                    <span className="w-7 shrink-0 text-text-tertiary">{net.label}</span>
                    <span className={broken ? 'text-text-primary' : 'text-text-secondary'}>
                      {net.members}
                    </span>
                    <span className={cn('ml-auto', broken ? 'text-fault' : 'text-text-tertiary')}>
                      {broken ? t('board.absent') : t('board.match')}
                    </span>
                  </>
                ) : (
                  <>
                    <span aria-hidden="true" className="size-4 shrink-0 rounded-full bg-bg-700" />
                    <span aria-hidden="true" className="h-2.5 w-7 shrink-0 rounded-pill bg-bg-700" />
                    <span aria-hidden="true" className="h-2.5 w-28 rounded-pill bg-bg-700" />
                    <span className="sr-only">{t('common.loading')}</span>
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {/* ---- the diagnosis --------------------------------------------------- */}
      <div className="border-t border-line px-5 py-4">
        {/* The eyebrow names the panel and does not change; the sentence below
            it is what changes. Swapping a sentence into the eyebrow slot would
            set it in caps, which the brief reserves for section labels. */}
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
          {t('board.diagnosisEyebrow')}
        </p>
        {/*
          Fixed height rather than a fade, so the panel is the same size at every
          stage. `min-h` on two lines of this size — the sentence never runs to
          three at any width the card is used at.
        */}
        <p
          className={cn(
            'mt-1.5 min-h-[3.25rem] text-pretty text-sm leading-relaxed',
            diagnosed ? 'text-text-secondary' : 'text-text-tertiary',
          )}
        >
          {diagnosed ? t('board.diagnosis') : t('board.hint')}
        </p>
      </div>
    </div>
  )
}
