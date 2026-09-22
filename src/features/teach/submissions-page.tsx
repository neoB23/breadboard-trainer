import { ArrowLeft, BarChart3, Eye } from 'lucide-react'
import * as React from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/page-header'
import { Button, EmptyState, Skeleton, StatusBadge } from '@/components/ui'
import { formatClock, formatDay } from '@/features/dashboard/library'
import { useLocale, useT } from '@/i18n'
import { api, isApiError } from '@/lib/api'
import { submissionsResponseSchema, type SubmissionsResponse } from '@shared/contracts/teach-authoring.ts'

import { TEACH_BODY, TEACH_HEADER, TeachShell } from './teach-shell'

/**
 * `/teach/exercises/:exerciseId/submissions` — every hand-in, with the score
 * the server gave it against the reference circuit.
 *
 * A score graded against a reference that has since been replaced is shown
 * as it was given and marked, rather than silently re-scored: it is what the
 * student saw, and changing a mark behind their back is not the instructor's
 * intent when they fix a reference.
 */
export function SubmissionsPage() {
  const t = useT()
  const locale = useLocale()
  const { exerciseId = '' } = useParams()

  const [state, setState] = React.useState<{
    id: string
    view: 'ready' | 'missing' | 'failed'
    data: SubmissionsResponse | null
  } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    api
      .get(`/teach/exercises/${exerciseId}/submissions`, submissionsResponseSchema)
      .then((data) => {
        if (!cancelled) setState({ id: exerciseId, view: 'ready', data })
      })
      .catch((error: unknown) => {
        if (cancelled || (isApiError(error) && error.isUnauthorized)) return
        const missing = isApiError(error) && (error.isNotFound || error.isForbidden || error.status === 400)
        setState({ id: exerciseId, view: missing ? 'missing' : 'failed', data: null })
      })
    return () => {
      cancelled = true
    }
  }, [exerciseId])

  const current = state?.id === exerciseId ? state : null
  const data = current?.data ?? null
  const scored = data?.items.filter((item) => item.score !== null) ?? []
  const average =
    scored.length === 0
      ? null
      : Math.round(scored.reduce((sum, item) => sum + (item.score ?? 0), 0) / scored.length)

  return (
    <TeachShell>
      <PageHeader
        className={TEACH_HEADER}
        breadcrumb={[
          { label: t('nav.teach'), to: '/teach' },
          { label: data?.exercise.title ?? t('teach.editor.crumb'), to: `/teach/exercises/${exerciseId}` },
          { label: t('teach.submissions.crumb') },
        ]}
        title={data?.exercise.title ?? t('teach.submissions.crumb')}
        subtitle={t('teach.submissions.subtitle')}
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link to="/teach">
              <ArrowLeft aria-hidden="true" />
              {t('nav.teach')}
            </Link>
          </Button>
        }
      />

      <div className={TEACH_BODY}>
        {current === null ? <Skeleton className="h-64 rounded-card" /> : null}

        {current?.view === 'missing' ? (
          <EmptyState icon={BarChart3} title={t('teach.editor.notFound')} />
        ) : null}
        {current?.view === 'failed' ? (
          <EmptyState
            icon={BarChart3}
            title={t('error.generic')}
            description={t('teach.submissions.failed')}
          />
        ) : null}

        {data !== null && data.items.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title={t('teach.submissions.empty.title')}
            description={t('teach.submissions.empty.description')}
          />
        ) : null}

        {data !== null && data.items.length > 0 ? (
          <>
            <p className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-secondary">
              <span>{t('teach.submissions.count', { count: data.items.length })}</span>
              {average !== null ? <span>{t('teach.submissions.average', { score: average })}</span> : null}
            </p>

            <div className="overflow-x-auto rounded-card border border-line bg-bg-800">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wide text-text-tertiary">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('teach.submissions.col.student')}</th>
                    <th className="px-4 py-3 font-medium">{t('teach.submissions.col.submitted')}</th>
                    <th className="px-4 py-3 font-medium">{t('teach.submissions.col.time')}</th>
                    <th className="px-4 py-3 font-medium">{t('teach.submissions.col.score')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map((item) => (
                    <tr key={item.attemptId} data-testid="submission-row">
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">{item.fullName}</p>
                        {item.studentNumber ? (
                          <p className="font-mono text-xs text-text-tertiary">{item.studentNumber}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatDay(item.submittedAt, locale)} ·{' '}
                        {formatClock(new Date(item.submittedAt), locale)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-text-secondary">
                        {item.durationMs === null
                          ? '—'
                          : t('teach.submissions.minutes', {
                              minutes: Math.max(1, Math.round(item.durationMs / 60_000)),
                            })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.score === null ? (
                            <StatusBadge tone="neutral">{t('teach.submissions.notScored')}</StatusBadge>
                          ) : (
                            <span
                              className="font-mono font-semibold tabular-nums text-text-primary"
                              data-testid="submission-score"
                            >
                              {item.score}
                              <span className="text-text-tertiary"> / 100</span>
                            </span>
                          )}
                          {item.stale ? (
                            <StatusBadge tone="warn">{t('teach.submissions.stale')}</StatusBadge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/results/${item.attemptId}`}>
                            <Eye aria-hidden="true" />
                            {t('teach.submissions.view')}
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </TeachShell>
  )
}
