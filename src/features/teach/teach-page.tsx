import { BarChart3, CircuitBoard, GraduationCap, Pencil, Plus } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/page-header'
import { Button, EmptyState, Eyebrow, Skeleton, StatusBadge } from '@/components/ui'
import { useT } from '@/i18n'
import { api, isApiError } from '@/lib/api'
import { classListResponseSchema } from '@shared/contracts'
import { teachExerciseListResponseSchema, type TeachExercise } from '@shared/contracts/teach-authoring.ts'

import { TEACH_BODY, TEACH_HEADER, TeachShell } from './teach-shell'

/**
 * `/teach` — the instructor's exercises, and the three things to do with one:
 * edit it, build its reference circuit in Learn Mode, and read the scores.
 *
 * The list carries a "reference captured" flag rather than the reference
 * itself — the same shape the API gives, for the same reason: a list of titles
 * has no business shipping every answer key in the class to render.
 */
export function TeachPage() {
  const t = useT()
  const [state, setState] = React.useState<{
    view: 'loading' | 'ready' | 'failed'
    items: TeachExercise[]
    classNames: Map<string, string>
  }>({ view: 'loading', items: [], classNames: new Map() })

  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      api.get('/teach/exercises', teachExerciseListResponseSchema),
      api.get('/teach/classes', classListResponseSchema),
    ])
      .then(([exercises, classes]) => {
        if (cancelled) return
        setState({
          view: 'ready',
          items: exercises.items,
          classNames: new Map(classes.items.map((item) => [item.id, item.name])),
        })
      })
      .catch((error: unknown) => {
        if (cancelled || (isApiError(error) && error.isUnauthorized)) return
        setState((current) => ({ ...current, view: 'failed' }))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <TeachShell>
      <PageHeader
        className={TEACH_HEADER}
        title={t('teach.title')}
        subtitle={t('teach.subtitle')}
        action={
          <Button size="sm" asChild>
            <Link to="/teach/exercises/new">
              <Plus aria-hidden="true" />
              {t('teach.exercises.new')}
            </Link>
          </Button>
        }
      />

      <div className={TEACH_BODY}>
        <Eyebrow marker>{t('teach.exercises.title')}</Eyebrow>

        {state.view === 'loading' ? (
          <div className="mt-4 flex flex-col gap-3">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-20 rounded-card" />
            ))}
          </div>
        ) : null}

        {state.view === 'failed' ? (
          <EmptyState
            className="mt-4"
            icon={GraduationCap}
            title={t('error.generic')}
            description={t('teach.exercises.failed')}
          />
        ) : null}

        {state.view === 'ready' && state.items.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={GraduationCap}
            title={t('teach.exercises.empty.title')}
            description={t('teach.exercises.empty.description')}
            action={
              <Button asChild>
                <Link to="/teach/exercises/new">{t('teach.exercises.new')}</Link>
              </Button>
            }
          />
        ) : null}

        {state.view === 'ready' && state.items.length > 0 ? (
          <ul className="mt-4 flex flex-col divide-y divide-line rounded-card border border-line bg-bg-800">
            {state.items.map((exercise) => (
              <li
                key={exercise.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                data-testid="teach-exercise"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/teach/exercises/${exercise.id}`}
                    className="font-medium text-text-primary underline-offset-4 hover:underline"
                  >
                    {exercise.title}
                  </Link>
                  <p className="mt-0.5 truncate text-sm text-text-tertiary">
                    {exercise.classId === null
                      ? t('teach.exercises.library')
                      : (state.classNames.get(exercise.classId) ?? '')}
                    {' · '}
                    {t('teach.exercises.attempts', { count: exercise.attemptCount })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge tone={exercise.hasReference ? 'ok' : 'warn'}>
                      {t(
                        exercise.hasReference
                          ? 'teach.exercises.status.captured'
                          : 'teach.exercises.status.notCaptured',
                      )}
                    </StatusBadge>
                    <StatusBadge tone={exercise.published ? 'info' : 'neutral'}>
                      {t(
                        exercise.published
                          ? 'teach.exercises.status.published'
                          : 'teach.exercises.status.draft',
                      )}
                    </StatusBadge>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/teach/exercises/${exercise.id}`}>
                      <Pencil aria-hidden="true" />
                      {t('teach.exercises.actions.edit')}
                    </Link>
                  </Button>
                  <Button variant="secondary" size="sm" asChild>
                    <Link to={`/teach/exercises/${exercise.id}/capture`}>
                      <CircuitBoard aria-hidden="true" />
                      {t('teach.exercises.actions.capture')}
                    </Link>
                  </Button>
                  <Button variant="secondary" size="sm" asChild>
                    <Link to={`/teach/exercises/${exercise.id}/submissions`}>
                      <BarChart3 aria-hidden="true" />
                      {t('teach.exercises.actions.scores')}
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </TeachShell>
  )
}
