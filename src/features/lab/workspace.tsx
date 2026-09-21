import { Check, Eraser, ScanLine, Send, Trash2, Undo2 } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { runChecks, type CheckResult, type TestReport } from '@/board/checks'
import {
  BOARD_COLUMNS,
  lowerHole,
  occupiedHoles,
  parseHole,
  pinCountFor,
  remainingFor,
  serializeBoard,
  upperHole,
  type Hole,
  type HoleId,
  type PlacedPart,
} from '@/board/model'
import { analyseBoard } from '@/board/nets'
import {
  Button,
  Callout,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Eyebrow,
  Progress,
  SegmentedControl,
  Spinner,
  StatusBadge,
  toast,
} from '@/components/ui'
import { useT, type MessageKey, type TranslateFn } from '@/i18n'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { attemptResponseSchema, type Attempt, type Bom, type BomItem } from '@shared/contracts'

import { PartThumb } from './part-art'
import { WorkspaceBoard } from './workspace-board'

/**
 * The workspace — parts out of the tray, onto the board, the nets extracted
 * live as they land, and a test run that says where the trouble is.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS REAL AND WHAT IS NOT
 *
 * Everything structural is real: the tray is the exercise's BOM and runs out;
 * placement seats legs in actual holes with actual occupancy; the netlist is a
 * genuine union-find over what was built; the test score is `src/board/checks`
 * run over that analysis, the same rubric every time; the board autosaves to
 * `PATCH /api/attempts/:id` and a refresh restores it; Hand in is a terminal
 * `POST .../submit`. The one simplification is electrical: "the LED lights"
 * means connectivity, not conduction — see the note in `src/board/nets.ts`.
 * The solver that knows the difference is Phase 16.
 * ---------------------------------------------------------------------------
 *
 * Two modes, one component. With an `attempt` this is an exercise: the BOM is
 * a budget, the test includes the completeness check, and Hand in exists.
 * Without one it is the free-build sandbox: the tray is a shelf, the board
 * persists to this browser, and the test checks only the electricity.
 *
 * Interaction is click-click, not drag. A drag can fail in more ways than it
 * can succeed on a trackpad in a lab, and Tinkercad itself places on click.
 */

const Circuit3D = React.lazy(() => import('./circuit-3d'))

interface Pending {
  item: BomItem
  holes: HoleId[]
}

export interface WorkspaceProps {
  bom: Bom
  /** Present for an exercise; absent in the sandbox. */
  attempt?: Attempt | null
  initialParts: PlacedPart[]
  /** Where the sandbox keeps its board. Ignored when `attempt` is set. */
  sandboxKey?: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'failed'
type BoardView = '2d' | '3d'

const SCAN_MS = 900

export function Workspace({ bom, attempt = null, initialParts, sandboxKey }: WorkspaceProps) {
  const t = useT()
  const navigate = useNavigate()

  const [parts, setParts] = React.useState<PlacedPart[]>(initialParts)
  const [history, setHistory] = React.useState<PlacedPart[][]>([])
  const [pending, setPending] = React.useState<Pending | null>(null)
  const [selected, setSelected] = React.useState<string | null>(null)
  const [focusedNet, setFocusedNet] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<MessageKey | null>(null)
  const [saveState, setSaveState] = React.useState<SaveState>('idle')
  const [submitting, setSubmitting] = React.useState(false)
  const [view, setView] = React.useState<BoardView>('2d')
  const [scan, setScan] = React.useState<number | null>(null)
  const [report, setReport] = React.useState<TestReport | null>(null)

  const occupied = React.useMemo(() => occupiedHoles(parts), [parts])
  const remaining = React.useMemo(() => remainingFor(bom, parts), [bom, parts])
  const analysis = React.useMemo(() => analyseBoard(parts, bom), [parts, bom])

  /* ---- placement --------------------------------------------------------- */

  const mutate = (next: PlacedPart[]) => {
    setHistory((stack) => [...stack.slice(-49), parts])
    setParts(next)
    setNotice(null)
    // The board changed under the report, so the report no longer describes it.
    setReport(null)
  }

  const place = (item: BomItem, holes: HoleId[]) => {
    const part: PlacedPart = {
      id: newPartId(),
      bomItemId: item.id,
      type: item.type,
      label: item.label,
      value: item.value,
      holes,
    }
    mutate([...parts, part])

    // Rapid placement, Tinkercad-style: the tray choice sticks until the line
    // runs out, so four jumpers are four pairs of clicks, not four round trips.
    const left = (remaining.get(item.id) ?? 0) - 1
    setPending(left > 0 ? { item, holes: [] } : null)
  }

  const handleHoleClick = (hole: HoleId) => {
    if (pending === null) {
      const owner = parts.find((part) => part.holes.includes(hole))
      if (owner) setSelected(owner.id)
      return
    }

    if (occupied.has(hole)) {
      setNotice('workspace.status.occupied')
      return
    }

    if (pending.item.type === 'transistor') {
      const seat = transistorSeat(hole, occupied)
      if (seat === null) {
        setNotice('workspace.status.transistorSpace')
        return
      }
      place(pending.item, seat)
      return
    }

    if (pending.holes.length === 0) {
      setPending({ ...pending, holes: [hole] })
      setNotice(null)
      return
    }

    const first = pending.holes[0]
    if (first === undefined || first === hole) return
    place(pending.item, [first, hole])
  }

  const handlePartClick = (partId: string) => {
    if (pending !== null) return
    setSelected((current) => (current === partId ? null : partId))
  }

  const pick = (item: BomItem) => {
    if ((remaining.get(item.id) ?? 0) === 0) return
    setPending({ item, holes: [] })
    setSelected(null)
    setNotice(null)
    // Placement lives on the flat board, where a click means one hole.
    setView('2d')
  }

  const undo = () => {
    const previous = history[history.length - 1]
    if (previous === undefined) return
    setHistory((stack) => stack.slice(0, -1))
    setParts(previous)
    setSelected(null)
    setPending(null)
    setReport(null)
  }

  const removeSelected = React.useCallback(() => {
    if (selected === null) return
    setHistory((stack) => [...stack.slice(-49), parts])
    setParts((current) => current.filter((part) => part.id !== selected))
    setSelected(null)
    setReport(null)
  }, [selected, parts])

  const clearBoard = () => {
    if (parts.length === 0) return
    mutate([])
    setSelected(null)
    setPending(null)
  }

  /* ---- keyboard ----------------------------------------------------------- */

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPending((current) => (current && current.holes.length > 0 ? { ...current, holes: [] } : null))
        setSelected(null)
      }
      if (event.key === 'Delete' || event.key === 'Backspace') removeSelected()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [removeSelected])

  /* ---- persistence -------------------------------------------------------- */

  const serialized = React.useMemo(() => serializeBoard(parts), [parts])
  const firstRender = React.useRef(true)

  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }

    if (attempt === null) {
      // The sandbox belongs to this browser. localStorage can refuse (private
      // windows, storage cleared); losing the convenience must not throw.
      if (sandboxKey !== undefined) {
        try {
          window.localStorage.setItem(sandboxKey, JSON.stringify(serialized))
          setSaveState('saved')
        } catch {
          setSaveState('failed')
        }
      }
      return
    }

    setSaveState('saving')
    const timer = window.setTimeout(() => {
      api
        .patch(`/attempts/${attempt.id}`, attemptResponseSchema, { finalState: serialized })
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('failed'))
    }, 800)

    return () => window.clearTimeout(timer)
  }, [serialized, attempt, sandboxKey])

  /* ---- the test run -------------------------------------------------------- */

  const scanFrame = React.useRef<number | null>(null)

  const runTest = React.useCallback(() => {
    if (scanFrame.current !== null) return
    setReport(null)
    setFocusedNet(null)

    const startedAt = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / SCAN_MS)
      setScan(progress)
      if (progress < 1) {
        scanFrame.current = requestAnimationFrame(step)
        return
      }
      scanFrame.current = null
      setScan(null)
      setReport(runChecks(parts, bom, analysis, { requireBom: attempt !== null }))
    }
    scanFrame.current = requestAnimationFrame(step)
  }, [parts, bom, analysis, attempt])

  React.useEffect(
    () => () => {
      if (scanFrame.current !== null) cancelAnimationFrame(scanFrame.current)
    },
    [],
  )

  /* ---- the completion moment ---------------------------------------------- */

  const wasComplete = React.useRef(analysis.complete)
  React.useEffect(() => {
    if (attempt !== null && analysis.complete && !wasComplete.current) {
      toast.ok(t('workspace.complete.title'), t('workspace.complete.toast'))
    }
    wasComplete.current = analysis.complete
  }, [analysis.complete, attempt, t])

  /* ---- leaving ------------------------------------------------------------ */

  const saveAndExit = async () => {
    if (attempt !== null) {
      try {
        await api.patch(`/attempts/${attempt.id}`, attemptResponseSchema, { finalState: serialized })
        toast.info(t('workspace.exitSaved'))
      } catch {
        // The autosave already carried the last stable snapshot; leaving is
        // still the right thing to let the person do.
      }
    }
    navigate('/dashboard')
  }

  const submit = async () => {
    if (attempt === null) return
    setSubmitting(true)
    try {
      await api.post(`/attempts/${attempt.id}/submit`, attemptResponseSchema, {
        finalState: serialized,
        durationMs: Math.max(0, Date.now() - new Date(attempt.startedAt).getTime()),
        completed: analysis.complete,
      })
      toast.ok(t(analysis.complete ? 'workspace.submitted' : 'workspace.submittedIncomplete'))
      navigate('/dashboard')
    } catch {
      toast.fault(t('error.generic'))
      setSubmitting(false)
    }
  }

  /* ---- derived readouts ---------------------------------------------------- */

  const placeableTotal = bom
    .filter((item) => pinCountFor(item.type) !== null)
    .reduce((total, item) => total + item.quantity, 0)
  const placedCount = parts.length
  const leds = parts.filter((part) => part.type === 'led')
  const isSandbox = attempt === null

  return (
    <div className="grid gap-6 xl:grid-cols-[15rem_minmax(0,1fr)_19rem]">
      {/* ---- tray --------------------------------------------------------- */}
      <aside className="rounded-card border border-line bg-bg-800 p-4">
        <Eyebrow marker>{t('workspace.tray.title')}</Eyebrow>
        {/*
          Each card carries a picture of the part itself — the same drawing the
          board renders, so what you pick is literally what lands. A tray you
          recognise by sight is the whole reason a physical tray works.
        */}
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-1">
          {bom.map((item) => {
            const left = remaining.get(item.id) ?? 0
            const placeable = pinCountFor(item.type) !== null
            const active = pending?.item.id === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!placeable || left === 0}
                  onClick={() => pick(item)}
                  className={cn(
                    'flex w-full flex-col items-stretch gap-1.5 rounded-card border p-2.5 text-left transition-colors xl:flex-row xl:items-center xl:gap-3',
                    active
                      ? 'border-accent bg-accent/10'
                      : 'border-line bg-bg-800 hover:border-line-strong hover:bg-bg-700',
                    (left === 0 || !placeable) &&
                      'cursor-not-allowed opacity-45 hover:border-line hover:bg-bg-800',
                  )}
                >
                  <PartThumb item={item} className="xl:w-16 xl:shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="min-w-0 truncate text-xs font-medium text-text-primary">
                      {item.label ?? item.type}
                    </span>
                    <span className="flex w-full items-baseline justify-between gap-2">
                      <span className="truncate font-mono text-micro text-text-tertiary">
                        {item.value ?? ''}
                      </span>
                      <span className="shrink-0 font-mono text-micro tabular-nums text-text-secondary">
                        {isSandbox ? '∞' : t('workspace.tray.left', { count: left })}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-text-tertiary">{t('workspace.hint.select')}</p>
      </aside>

      {/* ---- board -------------------------------------------------------- */}
      <section className="flex min-w-0 flex-col rounded-card border border-line bg-bg-800">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          {/* What to do next. Polite live region: the one line that always says
              where the interaction stands, for eyes and screen readers both. */}
          <p aria-live="polite" className="min-w-0 text-sm text-text-secondary">
            {scan !== null ? t('workspace.test.scanning') : statusLine(t, pending, notice)}
          </p>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <span
              className={cn('mr-2 text-xs', saveState === 'failed' ? 'text-warn-ink' : 'text-text-tertiary')}
            >
              {saveState === 'saving' ? t('workspace.saving') : null}
              {saveState === 'saved' ? t('workspace.saved') : null}
              {saveState === 'failed' ? t('workspace.saveFailed') : null}
            </span>
            <Button variant="ghost" size="sm" disabled={history.length === 0} onClick={undo}>
              <Undo2 aria-hidden="true" />
              {t('workspace.toolbar.undo')}
            </Button>
            <Button variant="ghost" size="sm" disabled={selected === null} onClick={removeSelected}>
              <Trash2 aria-hidden="true" />
              {t('workspace.toolbar.remove')}
            </Button>
            <Button variant="ghost" size="sm" disabled={parts.length === 0} onClick={clearBoard}>
              <Eraser aria-hidden="true" />
              {t('workspace.toolbar.clear')}
            </Button>
            <SegmentedControl
              label={t('workspace.view.label')}
              value={view}
              onValueChange={(next: BoardView) => setView(next)}
              options={[
                { value: '2d', label: t('workspace.view.flat') },
                { value: '3d', label: t('workspace.view.dimensional') },
              ]}
            />
          </div>
        </div>

        <div className="bg-bg-900 p-4 sm:p-6">
          {view === '3d' ? (
            <div className="aspect-[16/10] w-full">
              <React.Suspense
                fallback={
                  <div className="flex h-full items-center justify-center">
                    <Spinner size="lg" />
                  </div>
                }
              >
                <Circuit3D
                  parts={parts}
                  netOfNode={analysis.netOfNode}
                  powered={analysis.powered}
                  litLeds={analysis.litLeds}
                  className="size-full"
                />
              </React.Suspense>
            </div>
          ) : (
            <WorkspaceBoard
              parts={parts}
              refs={analysis.refs}
              occupied={occupied}
              pending={
                pending ? { type: pending.item.type, value: pending.item.value, holes: pending.holes } : null
              }
              netOfNode={analysis.netOfNode}
              powered={analysis.powered}
              focusedNet={focusedNet}
              litLeds={analysis.litLeds}
              selectedPartId={selected}
              scan={scan}
              onHoleClick={handleHoleClick}
              onPartClick={handlePartClick}
              holeLabel={(hole) => holeLabel(t, hole)}
              title={t('workspace.board.alt')}
            />
          )}
        </div>
      </section>

      {/* ---- readout ------------------------------------------------------- */}
      <aside className="flex flex-col gap-4">
        <section className="rounded-card border border-line bg-bg-800 p-4">
          <Progress
            value={placeableTotal === 0 ? 0 : Math.round((placedCount / placeableTotal) * 100)}
            label={t('workspace.progress.parts')}
            readout={isSandbox ? String(placedCount) : `${placedCount} / ${placeableTotal}`}
          />

          {leds.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {leds.map((led) => {
                const ref = analysis.refs.get(led.id) ?? 'D?'
                const lit = analysis.litLeds.has(led.id)
                return (
                  <li key={led.id}>
                    <StatusBadge tone={lit ? 'ok' : 'neutral'}>
                      {t(lit ? 'workspace.leds.lit' : 'workspace.leds.dark', { ref })}
                    </StatusBadge>
                  </li>
                )
              })}
            </ul>
          ) : null}

          {analysis.floating.size > 0 ? (
            <p className="mt-3 text-xs text-text-tertiary">
              {t('workspace.floating', { count: analysis.floating.size })}
            </p>
          ) : null}
        </section>

        {analysis.warnings.map((warning) => (
          <Callout
            key={warning.kind}
            tone={warning.kind === 'rail-short' ? 'fault' : 'warn'}
            title={t(
              warning.kind === 'rail-short' ? 'workspace.warning.railShort' : 'workspace.warning.ledDirect',
              { refs: warning.refs.join(', ') },
            )}
          />
        ))}

        {attempt !== null && analysis.complete ? (
          <Callout tone="ok" title={t('workspace.complete.title')}>
            {t('workspace.complete.body')}
          </Callout>
        ) : null}

        {/* ---- test results ------------------------------------------------- */}
        {report !== null ? <TestResults report={report} t={t} /> : null}

        {/* ---- the netlist, live ------------------------------------------- */}
        <section className="rounded-card border border-line bg-bg-800 p-4">
          <Eyebrow marker>{t('workspace.netlist.title')}</Eyebrow>
          {analysis.nets.length === 0 ? (
            <p className="mt-3 text-sm text-text-secondary">{t('workspace.netlist.empty')}</p>
          ) : (
            <ul className="mt-3 flex flex-col" onPointerLeave={() => setFocusedNet(null)}>
              {analysis.nets.map((net) => (
                <li key={net.id}>
                  <button
                    type="button"
                    onPointerEnter={() => setFocusedNet(net.id)}
                    onFocus={() => setFocusedNet(net.id)}
                    onBlur={() => setFocusedNet(null)}
                    className={cn(
                      'flex w-full items-baseline gap-3 rounded-sm px-2 py-1.5 text-left font-mono text-xs transition-colors',
                      focusedNet === net.id ? 'bg-accent/10 text-text-primary' : 'text-text-secondary',
                    )}
                  >
                    <span
                      className={cn(
                        'w-9 shrink-0 font-semibold',
                        analysis.powered.has(net.id) ? 'text-accent' : 'text-text-primary',
                      )}
                    >
                      {net.id}
                    </span>
                    <span className="min-w-0 break-words">{net.members.join(' · ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- actions ------------------------------------------------------ */}
        <div className="flex flex-col gap-2">
          <Button
            variant={isSandbox ? 'primary' : 'secondary'}
            disabled={parts.length === 0 || scan !== null}
            onClick={runTest}
          >
            <ScanLine aria-hidden="true" />
            {t(report === null ? 'workspace.test.run' : 'workspace.test.rerun')}
          </Button>

          {attempt !== null ? (
            <>
              <Dialog>
                <DialogTrigger asChild>
                  <Button disabled={parts.length === 0 || submitting}>
                    {analysis.complete ? <Check aria-hidden="true" /> : <Send aria-hidden="true" />}
                    {t('workspace.submit')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('workspace.submitDialog.title')}</DialogTitle>
                    <DialogDescription>
                      {t(
                        analysis.complete
                          ? 'workspace.submitDialog.complete'
                          : 'workspace.submitDialog.incomplete',
                      )}
                      {report !== null
                        ? ` ${t('workspace.submitDialog.score', { score: report.score })}`
                        : ''}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="secondary">{t('workspace.submitDialog.cancel')}</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button onClick={() => void submit()} loading={submitting}>
                        {t('workspace.submitDialog.confirm')}
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant="secondary" onClick={() => void saveAndExit()}>
                {t('workspace.toolbar.saveExit')}
              </Button>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Test results                                                               */
/* -------------------------------------------------------------------------- */

const CHECK_COPY: Record<CheckResult['id'], { ok: MessageKey; fail: MessageKey }> = {
  'parts-placed': { ok: 'workspace.check.parts.ok', fail: 'workspace.check.parts.fail' },
  'no-shorts': { ok: 'workspace.check.shorts.ok', fail: 'workspace.check.shorts.fail' },
  'all-connected': { ok: 'workspace.check.connected.ok', fail: 'workspace.check.connected.fail' },
  'leds-light': { ok: 'workspace.check.leds.ok', fail: 'workspace.check.leds.fail' },
  'led-protected': { ok: 'workspace.check.protected.ok', fail: 'workspace.check.protected.fail' },
}

/**
 * The scan's verdict: the score as a headline, then one line per check. A
 * failed line names its refs and the columns to look at — the report points at
 * the board rather than shrugging at it.
 */
function TestResults({ report, t }: { report: TestReport; t: TranslateFn }) {
  const perfect = report.score === 100

  return (
    <section
      className={cn(
        'rounded-card border p-4',
        perfect ? 'border-ok-line bg-ok-surface' : 'border-line bg-bg-800',
      )}
    >
      <div className="flex items-baseline justify-between gap-4">
        <Eyebrow marker>{t('workspace.test.title')}</Eyebrow>
        <span className="font-mono text-xs text-text-tertiary">
          {report.passed} / {report.total}
        </span>
      </div>

      <p
        className={cn(
          'mt-2 font-display text-display-sm font-semibold tabular-nums',
          perfect ? 'text-ok-ink' : 'text-text-primary',
        )}
      >
        {report.score}%
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {report.checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2">
            <StatusBadge tone={check.ok ? 'ok' : 'fault'} className="mt-0.5 shrink-0">
              {check.ok ? t('workspace.test.pass') : t('workspace.test.fail')}
            </StatusBadge>
            <span className="text-pretty text-sm leading-snug text-text-secondary">
              {t(check.ok ? CHECK_COPY[check.id].ok : CHECK_COPY[check.id].fail, {
                refs: check.refs.join(', '),
                columns: check.columns.join(', '),
              })}
            </span>
          </li>
        ))}
      </ul>

      {perfect ? <p className="mt-3 text-sm text-ok-ink">{t('workspace.test.perfect')}</p> : null}
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function newPartId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
}

/**
 * A transistor seats three legs in three adjacent columns of the same bank row,
 * clicked at the middle one — and never on a rail, where its legs would all
 * land on one node.
 */
function transistorSeat(hole: HoleId, occupied: Set<HoleId>): HoleId[] | null {
  const parsed = parseHole(hole)
  if (parsed === null || (parsed.kind !== 'upper' && parsed.kind !== 'lower')) return null
  if (parsed.column < 1 || parsed.column > BOARD_COLUMNS - 2) return null

  const make = parsed.kind === 'upper' ? upperHole : lowerHole
  const seat = [make(parsed.column - 1, parsed.row), hole, make(parsed.column + 1, parsed.row)]
  return seat.some((candidate) => occupied.has(candidate)) ? null : seat
}

function statusLine(t: TranslateFn, pending: Pending | null, notice: MessageKey | null): string {
  if (notice !== null) return t(notice)
  if (pending === null) return t('workspace.status.pick')

  const part = pending.item.label ?? pending.item.type
  if (pending.item.type === 'transistor') return t('workspace.status.transistor')
  if (pending.holes.length === 0) {
    return pending.item.type === 'led'
      ? t('workspace.status.firstLeadLed', { part })
      : t('workspace.status.firstLead', { part })
  }
  return pending.item.type === 'led'
    ? t('workspace.status.secondLeadLed')
    : t('workspace.status.secondLead', { part })
}

function holeLabel(t: TranslateFn, hole: Hole): string {
  switch (hole.kind) {
    case 'upper':
      return t('workspace.hole.upper', { column: hole.column + 1, row: hole.row + 1 })
    case 'lower':
      return t('workspace.hole.lower', { column: hole.column + 1, row: hole.row + 1 })
    case 'railTop':
      return t('workspace.hole.railTop', { column: hole.column + 1 })
    case 'railBottom':
      return t('workspace.hole.railBottom', { column: hole.column + 1 })
  }
}
