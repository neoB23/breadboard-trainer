import { ArrowLeft, CircuitBoard, Send } from 'lucide-react'
import * as React from 'react'
import { Link, useParams } from 'react-router-dom'

import { parseBoardState, serializeBoard, type PlacedPart } from '@/board/model'
import { PageHeader } from '@/components/layout/page-header'
import { Button, EmptyState, Skeleton, StatusBadge, toast } from '@/components/ui'
import { Workspace } from '@/features/lab/workspace'
import { useT } from '@/i18n'
import { api, isApiError } from '@/lib/api'
import {
  captureReferenceResponseSchema,
  referenceViewResponseSchema,
  teachExerciseResponseSchema,
  type TeachExercise,
} from '@shared/contracts/teach-authoring.ts'

import { TEACH_BODY, TEACH_HEADER, TeachShell } from './teach-shell'

/**
 * `/teach/exercises/:exerciseId/capture` — Learn Mode.
 *
 * The instructor builds the reference circuit on the same board, from the
 * same tray, that the student will get. The checks it must pass to become an
 * answer key run live beside it (the workspace's capture mode), and Capture
 * sends the board — not a netlist — so the server derives the reference with
 * the very functions it will grade with.
 *
 * Coming back later puts the captured circuit back on the board. An unsaved
 * draft on this computer wins over it, so an interrupted rebuild is not lost.
 */
export function CapturePage() {
  const t = useT()
  const { exerciseId = '' } = useParams()
  const draftKey = `bbt.capture.${exerciseId}`

  const [state, setState] = React.useState<{
    id: string
    view: 'ready' | 'missing' | 'failed'
    exercise: TeachExercise | null
    initialParts: PlacedPart[]
  } | null>(null)
  const [publishing, setPublishing] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    api
      .get(`/teach/exercises/${exerciseId}/reference`, referenceViewResponseSchema, { allowAnswerKey: true })
      .then((response) => {
        if (cancelled) return
        const bom = response.exercise.bom
        const draft = readDraft(draftKey)
        const draftParts = draft === null ? [] : parseBoardState(draft, bom)
        const initialParts =
          draftParts.length > 0
            ? draftParts
            : response.reference
              ? parseBoardState(response.reference.referenceBoard, bom)
              : []
        setState({ id: exerciseId, view: 'ready', exercise: response.exercise, initialParts })
      })
      .catch((error: unknown) => {
        if (cancelled || (isApiError(error) && error.isUnauthorized)) return
        const missing = isApiError(error) && (error.isNotFound || error.isForbidden || error.status === 400)
        setState({ id: exerciseId, view: missing ? 'missing' : 'failed', exercise: null, initialParts: [] })
      })
    return () => {
      cancelled = true
    }
  }, [exerciseId, draftKey])

  const current = state?.id === exerciseId ? state : null
  const exercise = current?.exercise ?? null

  const setExercise = (next: TeachExercise) =>
    setState((previous) => (previous === null ? previous : { ...previous, exercise: next }))

  const onCapture = async (parts: PlacedPart[], confirmReplace: boolean) => {
    try {
      const response = await api.post(
        `/teach/exercises/${exerciseId}/capture`,
        captureReferenceResponseSchema,
        {
          board: serializeBoard(parts),
          confirmReplace,
        },
      )
      setExercise(response.exercise)
      toast.ok(
        confirmReplace
          ? t('teach.capture.doneReplaced', { count: response.invalidatedAttempts })
          : t('teach.capture.done'),
      )
    } catch (error) {
      toast.fault(isApiError(error) ? error.message : t('error.generic'))
    }
  }

  const publish = async () => {
    setPublishing(true)
    try {
      const response = await api.post(`/teach/exercises/${exerciseId}/publish`, teachExerciseResponseSchema, {
        published: true,
      })
      setExercise(response.exercise)
      toast.ok(t('teach.editor.publish.on'))
    } catch (error) {
      toast.fault(isApiError(error) ? error.message : t('error.generic'))
    } finally {
      setPublishing(false)
    }
  }

  return (
    <TeachShell>
      <PageHeader
        className={TEACH_HEADER}
        breadcrumb={[
          { label: t('nav.teach'), to: '/teach' },
          { label: exercise?.title ?? t('teach.editor.crumb'), to: `/teach/exercises/${exerciseId}` },
          { label: t('teach.capture.crumb') },
        ]}
        title={exercise?.title ?? t('teach.capture.crumb')}
        subtitle={t('teach.capture.subtitle')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {exercise?.published ? (
              <StatusBadge tone="info">{t('teach.capture.published')}</StatusBadge>
            ) : exercise?.hasReference ? (
              <Button size="sm" loading={publishing} onClick={() => void publish()}>
                <Send aria-hidden="true" />
                {t('teach.capture.publish')}
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" asChild>
              <Link to={`/teach/exercises/${exerciseId}`}>
                <ArrowLeft aria-hidden="true" />
                {t('teach.capture.toEditor')}
              </Link>
            </Button>
          </div>
        }
      />

      <div className={TEACH_BODY}>
        {current === null ? <Skeleton className="aspect-[16/7] rounded-card" /> : null}

        {current?.view === 'missing' ? (
          <EmptyState
            icon={CircuitBoard}
            title={t('teach.editor.notFound')}
            action={
              <Button asChild>
                <Link to="/teach">{t('nav.teach')}</Link>
              </Button>
            }
          />
        ) : null}

        {current?.view === 'failed' ? (
          <EmptyState
            icon={CircuitBoard}
            title={t('error.generic')}
            description={t('teach.capture.failed')}
          />
        ) : null}

        {current?.view === 'ready' && exercise ? (
          <>
            <p className="mb-4 text-xs text-text-tertiary">{t('teach.capture.draftNote')}</p>
            <Workspace
              key={exerciseId}
              bom={exercise.bom}
              initialParts={current.initialParts}
              mode={{ kind: 'capture', draftKey, hasReference: exercise.hasReference, onCapture }}
            />
          </>
        ) : null}
      </div>
    </TeachShell>
  )
}

function readDraft(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}
