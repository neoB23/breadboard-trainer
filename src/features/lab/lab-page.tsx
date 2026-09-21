import { ArrowLeft, BookOpen, Layers, Wrench } from 'lucide-react'
import * as React from 'react'
import { Link, useParams } from 'react-router-dom'

import { parseBoardState, type PlacedPart } from '@/board/model'
import { BlueprintBackdrop, Breadboard } from '@/components/board'
import { AppNavItem, AppShell, type AppShellUser } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/layout/page-header'
import {
  Badge,
  Button,
  Chip,
  DifficultyMeter,
  EmptyState,
  Eyebrow,
  Skeleton,
  StatusBadge,
  toast,
} from '@/components/ui'
import { useAuthStore } from '@/features/auth/auth-store'
import { useT } from '@/i18n'
import { api, isApiError } from '@/lib/api'
import {
  attemptStartResponseSchema,
  exerciseDetailResponseSchema,
  type AssignedExercise,
  type Attempt,
} from '@shared/contracts'

import { Workspace } from './workspace'

/**
 * `/lab/:exerciseId` — the brief, and the workspace behind it.
 *
 * The brief is the front matter: objective, parts, where you have got to. The
 * workspace is the board itself. "Build the circuit" is the seam between them,
 * and it is also where the attempt becomes real: the button calls
 * `POST /api/attempts`, which either starts a row or hands back the open one,
 * and the snapshot that comes back is what the board restores from.
 *
 * A student with an attempt already open skips the brief entirely — they were
 * mid-build, and the polite thing to do with someone's half-finished board is
 * to put it back in front of them.
 */

/** The whole board, uncropped. This is the thing you are about to build on. */
const LAB_CROP = { columns: [0, 19], band: 'full' } as const

interface BuildSession {
  attempt: Attempt
  initialParts: PlacedPart[]
}

export function LabPage() {
  const t = useT()
  const { exerciseId = '' } = useParams()
  const session = useAuthStore((state) => state.session)
  const signOut = useAuthStore((state) => state.signOut)

  /**
   * The id is carried *inside* the result rather than reset by the effect.
   *
   * React Router keeps this component mounted when only `:exerciseId` changes,
   * so a result from the previous exercise would otherwise be on screen while
   * the new one loads — under someone else's title. Comparing the two during
   * render means the stale result is never displayed at all.
   */
  const [result, setResult] = React.useState<{
    id: string
    view: 'ready' | 'missing' | 'failed'
    exercise: AssignedExercise | null
  } | null>(null)

  const [build, setBuild] = React.useState<(BuildSession & { exerciseId: string }) | null>(null)
  const [starting, setStarting] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    api
      .get(`/exercises/${exerciseId}`, exerciseDetailResponseSchema)
      .then((response) => {
        if (cancelled) return
        setResult({ id: exerciseId, view: 'ready', exercise: response.exercise })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        // A 401 is the session expiring and the route guard already owns it.
        if (isApiError(error) && error.isUnauthorized) return

        // The endpoint answers 404 for an unpublished exercise, 403 for one
        // belonging to a class this student is not in, and 400 for an id that is
        // not a UUID at all. All three mean the same thing to the person reading
        // the screen — this is not one of yours — and distinguishing them would
        // be a small oracle for what exists.
        const missing = isApiError(error) && (error.isNotFound || error.isForbidden || error.status === 400)
        setResult({ id: exerciseId, view: missing ? 'missing' : 'failed', exercise: null })
      })

    return () => {
      cancelled = true
    }
  }, [exerciseId])

  const current = result?.id === exerciseId ? result : null
  const state = current?.view ?? 'loading'
  const exercise = current?.exercise ?? null
  const building = build !== null && build.exerciseId === exerciseId

  const startBuild = React.useCallback(
    async (target: AssignedExercise) => {
      setStarting(true)
      try {
        const response = await api.post('/attempts', attemptStartResponseSchema, {
          exerciseId: target.id,
        })
        setBuild({
          exerciseId: target.id,
          attempt: response.attempt,
          initialParts: parseBoardState(response.attempt.finalState, target.bom),
        })
      } catch {
        toast.fault(t('error.generic'))
      } finally {
        setStarting(false)
      }
    },
    [t],
  )

  /**
   * Straight back onto the board when an attempt is open. `POST /api/attempts`
   * is idempotent — with an open attempt it can only return that attempt — so
   * this cannot create a row for someone who was merely reading the brief.
   */
  const autoResumed = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (exercise === null || building) return
    if (exercise.progress.openAttemptId === null) return
    if (autoResumed.current === exercise.id) return
    autoResumed.current = exercise.id
    void startBuild(exercise)
  }, [exercise, building, startBuild])

  const profile = session?.profile
  const user: AppShellUser | undefined = profile
    ? { name: profile.fullName, email: session.user.email, role: profile.role }
    : undefined

  return (
    <AppShell
      user={user}
      onSignOut={() => void signOut()}
      nav={
        <>
          <AppNavItem to="/dashboard">{t('nav.dashboard')}</AppNavItem>
          <AppNavItem to="/sandbox">{t('nav.sandbox')}</AppNavItem>
          <AppNavItem to="/settings">{t('nav.settings')}</AppNavItem>
        </>
      }
    >
      <PageHeader
        className="[&>div]:mx-auto [&>div]:w-full [&>div]:max-w-shell"
        breadcrumb={[{ label: t('nav.dashboard'), to: '/dashboard' }, { label: t('lab.crumb') }]}
        title={exercise?.title ?? t('lab.loadingTitle')}
        subtitle={exercise?.objective ?? undefined}
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link to="/dashboard">
              <ArrowLeft aria-hidden="true" />
              {t('lab.back')}
            </Link>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-shell px-4 pb-20 pt-8 sm:px-6">
        {state === 'loading' ? <LabSkeleton /> : null}

        {state === 'missing' ? (
          <EmptyState
            icon={BookOpen}
            title={t('lab.notFound.title')}
            description={t('lab.notFound.description')}
            action={
              <Button asChild>
                <Link to="/dashboard">{t('lab.back')}</Link>
              </Button>
            }
          />
        ) : null}

        {state === 'failed' ? (
          <EmptyState icon={BookOpen} title={t('error.generic')} description={t('lab.failed.description')} />
        ) : null}

        {state === 'ready' && exercise ? (
          building && build ? (
            <Workspace bom={exercise.bom} attempt={build.attempt} initialParts={build.initialParts} />
          ) : (
            <Brief exercise={exercise} starting={starting} onBuild={() => void startBuild(exercise)} />
          )
        ) : null}
      </div>
    </AppShell>
  )
}

/* -------------------------------------------------------------------------- */

function Brief({
  exercise,
  starting,
  onBuild,
}: {
  exercise: AssignedExercise
  starting: boolean
  onBuild: () => void
}) {
  const t = useT()
  const parts = exercise.bom.reduce((total, item) => total + item.quantity, 0)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {/* ---- the board you are about to build on --------------------------- */}
      <section className="relative isolate overflow-hidden rounded-card border border-line bg-bg-800">
        <BlueprintBackdrop cell={24} fade="none" />

        <div className="relative flex flex-col">
          <div className="flex items-center justify-center border-b border-line bg-bg-900 p-6 sm:p-8">
            <div className="w-full max-w-xl">
              {/* `placed={0}` is the honest picture: the board is bare until the
                  student builds on it. */}
              <Breadboard crop={LAB_CROP} placed={0} className="w-full" title={t('lab.board.alt')} />
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <Eyebrow marker>{t('lab.preview.eyebrow')}</Eyebrow>
            <h2 className="mt-2 font-display text-xl font-semibold text-text-primary">
              {t('lab.preview.title')}
            </h2>
            <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-text-secondary">
              {t('lab.preview.description')}
            </p>
          </div>
        </div>
      </section>

      {/* ---- the tray, as far as it is known ------------------------------- */}
      <aside className="flex flex-col gap-6">
        <section className="rounded-card border border-line bg-bg-800 p-5">
          <Eyebrow>{t('lab.parts.title')}</Eyebrow>

          {exercise.bom.length > 0 ? (
            <>
              <ul className="mt-4 flex flex-wrap gap-2">
                {exercise.bom.map((item) => (
                  <li key={item.id}>
                    <Chip>
                      {item.quantity > 1 ? `${item.quantity} × ` : ''}
                      {item.label ?? item.type}
                      {item.value ? ` · ${item.value}` : ''}
                    </Chip>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-center gap-1.5 text-xs text-text-tertiary">
                <Layers aria-hidden="true" className="size-3.5" />
                {t('dashboard.library.parts')}
                <span className="font-medium tabular-nums text-text-secondary">{parts}</span>
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-text-secondary">{t('lab.parts.empty')}</p>
          )}
        </section>

        <section className="rounded-card border border-line bg-bg-800 p-5">
          <Eyebrow>{t('lab.status.title')}</Eyebrow>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {exercise.progress.status === 'completed' ? (
              <StatusBadge tone="ok">{t('dashboard.status.completed')}</StatusBadge>
            ) : exercise.progress.status === 'in_progress' ? (
              <StatusBadge tone="info">{t('dashboard.status.inProgress')}</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">{t('dashboard.status.notStarted')}</StatusBadge>
            )}

            {exercise.difficulty !== null ? (
              <Badge tone="neutral" className="gap-2">
                <DifficultyMeter
                  size="sm"
                  level={exercise.difficulty}
                  label={t('dashboard.next.difficulty', { level: exercise.difficulty })}
                />
                <span aria-hidden="true">
                  {t('dashboard.next.difficulty', { level: exercise.difficulty })}
                </span>
              </Badge>
            ) : null}
          </div>

          <p className="mt-4 text-sm text-text-secondary">
            {t('dashboard.next.attempts', { count: exercise.progress.attemptCount })}
          </p>

          <Button className="mt-5 w-full" onClick={onBuild} loading={starting}>
            <Wrench aria-hidden="true" />
            {t(exercise.progress.status === 'completed' ? 'lab.buildAgain' : 'lab.build')}
          </Button>
          <p className="mt-2 text-xs text-text-tertiary">{t('lab.buildHint')}</p>
        </section>
      </aside>
    </div>
  )
}

function LabSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Skeleton className="aspect-[6/5] rounded-card" />
      <div className="flex flex-col gap-6">
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-52 rounded-card" />
      </div>
    </div>
  )
}
