import { ArrowLeft, ClipboardCheck, Lightbulb, RotateCcw, Sparkles } from 'lucide-react'
import * as React from 'react'
import { Link, useParams } from 'react-router-dom'

import { AppNavItem, AppShell, type AppShellUser } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/layout/page-header'
import {
  Button,
  Callout,
  EmptyState,
  Eyebrow,
  ProgressRing,
  Skeleton,
  StatusBadge,
  TextButton,
} from '@/components/ui'
import { useAuthStore } from '@/features/auth/auth-store'
import { formatClock, formatDay } from '@/features/dashboard/library'
import { useLocale, useT, type MessageKey, type TranslateFn } from '@/i18n'
import { en } from '@/i18n/en'
import { findingText } from '@/i18n/findings'
import { api, isApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  attemptResultResponseSchema,
  type AttemptResultResponse,
  type FeedbackView,
  type Finding,
  type Grade,
  type GradeLine,
} from '@shared/contracts'

/**
 * `/results/:attemptId` — what a student reads straight after handing in.
 *
 * The score and its four lines come first, because that is what they came to
 * see. Then at most three things to look at, hint first: each shows the
 * guiding question, and the fix waits behind a click. Letting a student try
 * the question before reading the answer is the whole difference between
 * feedback and a correction.
 *
 * Everything here was decided on the server. The page renders it; it scores
 * nothing and knows nothing about the reference circuit. When the AI Coach
 * wrote the words, they are its words, already checked against the facts; when
 * it did not — no model, a slow one, one that failed the check — the words
 * come from the catalogue, in the student's language, and the page looks the
 * same either way.
 */

type View = 'loading' | 'ready' | 'missing' | 'failed'

export function ResultsPage() {
  const t = useT()
  const locale = useLocale()
  const { attemptId = '' } = useParams()
  const session = useAuthStore((state) => state.session)
  const signOut = useAuthStore((state) => state.signOut)

  const [result, setResult] = React.useState<{
    id: string
    view: View
    data: AttemptResultResponse | null
  } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    api
      .get(`/attempts/${attemptId}/result`, attemptResultResponseSchema)
      .then((data) => {
        if (!cancelled) setResult({ id: attemptId, view: 'ready', data })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (isApiError(error) && error.isUnauthorized) return
        const missing = isApiError(error) && (error.isNotFound || error.isForbidden || error.status === 400)
        setResult({ id: attemptId, view: missing ? 'missing' : 'failed', data: null })
      })
    return () => {
      cancelled = true
    }
  }, [attemptId])

  const current = result?.id === attemptId ? result : null
  const view = current?.view ?? 'loading'
  const data = current?.data ?? null

  const profile = session?.profile
  const isTeacher = profile?.role === 'instructor' || profile?.role === 'admin'
  const user: AppShellUser | undefined = profile
    ? { name: profile.fullName, email: session.user.email, role: profile.role }
    : undefined

  const back = isTeacher
    ? {
        to: data ? `/teach/exercises/${data.exercise.id}/submissions` : '/teach',
        label: t('teach.submissions.back'),
      }
    : { to: '/dashboard', label: t('results.actions.dashboard') }

  const submittedAt = data?.attempt.submittedAt
  const when = submittedAt
    ? `${formatDay(submittedAt, locale) ?? ''} · ${formatClock(new Date(submittedAt), locale)}`
    : null

  return (
    <AppShell
      user={user}
      onSignOut={() => void signOut()}
      nav={
        isTeacher ? (
          <>
            <AppNavItem to="/teach">{t('nav.teach')}</AppNavItem>
            <AppNavItem to="/settings">{t('nav.settings')}</AppNavItem>
          </>
        ) : (
          <>
            <AppNavItem to="/dashboard">{t('nav.dashboard')}</AppNavItem>
            <AppNavItem to="/sandbox">{t('nav.sandbox')}</AppNavItem>
            <AppNavItem to="/settings">{t('nav.settings')}</AppNavItem>
          </>
        )
      }
    >
      <PageHeader
        className="[&>div]:mx-auto [&>div]:w-full [&>div]:max-w-shell"
        breadcrumb={[{ label: back.label, to: back.to }, { label: t('results.crumb') }]}
        title={data?.exercise.title ?? t('results.loadingTitle')}
        subtitle={when ? t('results.submittedAt', { when }) : undefined}
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link to={back.to}>
              <ArrowLeft aria-hidden="true" />
              {back.label}
            </Link>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-shell px-4 pb-20 pt-8 sm:px-6">
        {view === 'loading' ? <ResultsSkeleton /> : null}

        {view === 'missing' ? (
          <EmptyState
            icon={ClipboardCheck}
            title={t('results.notFound.title')}
            description={t('results.notFound.description')}
            action={
              <Button asChild>
                <Link to={back.to}>{back.label}</Link>
              </Button>
            }
          />
        ) : null}

        {view === 'failed' ? (
          <EmptyState
            icon={ClipboardCheck}
            title={t('error.generic')}
            description={t('results.failed.description')}
          />
        ) : null}

        {view === 'ready' && data ? <Result data={data} isTeacher={isTeacher} /> : null}
      </div>
    </AppShell>
  )
}

/* -------------------------------------------------------------------------- */

function Result({ data, isTeacher }: { data: AttemptResultResponse; isTeacher: boolean }) {
  const t = useT()
  const retry = `/lab/${data.exercise.id}`

  if (data.attempt.submittedAt === null) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title={t('results.open.title')}
        description={t('results.open.description')}
        action={
          isTeacher ? undefined : (
            <Button asChild>
              <Link to={retry}>{t('results.open.action')}</Link>
            </Button>
          )
        }
      />
    )
  }

  if (data.grade === null) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title={t('results.ungraded.title')}
        description={t('results.ungraded.description')}
      />
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4">
        <ScoreCard grade={data.grade} t={t} />
        {!isTeacher ? (
          <Button variant="secondary" asChild>
            <Link to={retry}>
              <RotateCcw aria-hidden="true" />
              {t('results.actions.retry')}
            </Link>
          </Button>
        ) : null}
      </aside>

      <div className="flex flex-col gap-6">
        {data.stale ? <Callout tone="info" title={t('results.stale')} /> : null}
        <Suggestions findings={data.findings} feedback={data.feedback} t={t} />
        <Breakdown lines={data.grade.lines} t={t} />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* The score                                                                  */
/* -------------------------------------------------------------------------- */

function ScoreCard({ grade, t }: { grade: Grade; t: TranslateFn }) {
  const perfect = grade.score === grade.max
  return (
    <section
      className={cn(
        'flex flex-col items-center gap-3 rounded-card border p-6 text-center',
        perfect ? 'border-ok-line bg-ok-surface' : 'border-line bg-bg-800',
      )}
    >
      <Eyebrow>{t('results.scoreLabel')}</Eyebrow>
      <ProgressRing value={grade.score} size={132} thickness={10}>
        <span
          className={cn(
            'font-display text-display-sm font-semibold tabular-nums',
            perfect ? 'text-ok-ink' : 'text-text-primary',
          )}
          data-testid="result-score"
        >
          {grade.score}
        </span>
      </ProgressRing>
      <p className="font-mono text-xs text-text-tertiary">{t('results.scoreOf', { score: grade.score })}</p>
    </section>
  )
}

const LINE_TITLE: Record<GradeLine['id'], MessageKey> = {
  circuit: 'grade.line.circuit',
  parts: 'grade.line.parts',
  polarity: 'grade.line.polarity',
  safety: 'grade.line.safety',
}

function isMessageKey(code: string): code is MessageKey {
  return Object.prototype.hasOwnProperty.call(en, code)
}

function Breakdown({ lines, t }: { lines: GradeLine[]; t: TranslateFn }) {
  return (
    <section className="rounded-card border border-line bg-bg-800 p-5">
      <Eyebrow marker>{t('results.breakdown.title')}</Eyebrow>
      <ul className="mt-4 flex flex-col divide-y divide-line">
        {lines.map((line) => {
          const full = line.earned === line.possible
          return (
            <li key={line.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">{t(LINE_TITLE[line.id])}</p>
                <p className="mt-0.5 text-pretty text-sm text-text-secondary">
                  {isMessageKey(line.reason.code) ? t(line.reason.code, line.reason.params) : null}
                </p>
              </div>
              <StatusBadge
                tone={full ? 'ok' : line.earned === 0 ? 'fault' : 'warn'}
                className="shrink-0 tabular-nums"
              >
                {t('results.breakdown.points', { earned: line.earned, possible: line.possible })}
              </StatusBadge>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* What to look at — hint first                                               */
/* -------------------------------------------------------------------------- */

function Suggestions({
  findings,
  feedback,
  t,
}: {
  findings: Finding[]
  feedback: FeedbackView | null
  t: TranslateFn
}) {
  const fromModel = feedback?.source === 'model'
  const source = (
    <StatusBadge tone={fromModel ? 'info' : 'neutral'}>
      {fromModel ? <Sparkles aria-hidden="true" className="size-3" /> : null}
      {t(fromModel ? 'results.source.model' : 'results.source.rules')}
    </StatusBadge>
  )

  if (findings.length === 0) {
    return (
      <Callout tone="ok" title={t('results.clean.title')} action={source}>
        {feedback?.praise ?? t('coach.clean.praise')}
      </Callout>
    )
  }

  return (
    <section className="rounded-card border border-line bg-bg-800 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Eyebrow marker>{t('results.suggestions.title')}</Eyebrow>
        {source}
      </div>
      <p className="mt-2 text-sm text-text-tertiary">{t('results.suggestions.lead')}</p>

      <ol className="mt-4 flex flex-col gap-3">
        {findings.map((finding, index) => {
          const worded = feedback?.suggestions.find((suggestion) => suggestion.findingId === finding.id)
          const text = worded ?? findingText(finding, t)
          return (
            <Suggestion key={finding.id} index={index + 1} question={text.question} fix={text.fix} t={t} />
          )
        })}
      </ol>
    </section>
  )
}

function Suggestion({
  index,
  question,
  fix,
  t,
}: {
  index: number
  question: string
  fix: string
  t: TranslateFn
}) {
  const [open, setOpen] = React.useState(false)
  const fixId = React.useId()

  return (
    <li className="rounded-card border border-line bg-bg-900 p-4" data-testid="suggestion">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/10 font-mono text-xs font-semibold text-accent">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-pretty text-sm font-medium leading-snug text-text-primary">
            <Lightbulb aria-hidden="true" className="mr-1.5 inline size-3.5 align-[-2px] text-warn-ink" />
            {question}
          </p>

          <TextButton
            className="mt-2 text-xs"
            aria-expanded={open}
            aria-controls={fixId}
            onClick={() => setOpen((value) => !value)}
          >
            {t(open ? 'results.suggestions.hideFix' : 'results.suggestions.showFix')}
          </TextButton>

          <div id={fixId} hidden={!open} className="mt-2 rounded-sm border-l-2 border-accent pl-3">
            <p className="text-micro font-medium uppercase tracking-wide text-text-tertiary">
              {t('results.suggestions.fixLabel')}
            </p>
            <p className="mt-0.5 text-pretty text-sm text-text-secondary">{fix}</p>
          </div>
        </div>
      </div>
    </li>
  )
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <Skeleton className="h-64 rounded-card" />
      <div className="flex flex-col gap-6">
        <Skeleton className="h-48 rounded-card" />
        <Skeleton className="h-56 rounded-card" />
      </div>
    </div>
  )
}
