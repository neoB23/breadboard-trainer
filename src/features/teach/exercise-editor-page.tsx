import { BarChart3, CircuitBoard, GraduationCap, Plus, X } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/page-header'
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
  EmptyState,
  Eyebrow,
  Field,
  Input,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatusBadge,
  Switch,
  Textarea,
  toast,
} from '@/components/ui'
import { useT, type MessageKey } from '@/i18n'
import { api, isApiError } from '@/lib/api'
import {
  classListResponseSchema,
  type BomItem,
  type ClassSummary,
  type ComponentType,
} from '@shared/contracts'
import {
  exerciseCreateRequestSchema,
  exerciseUpdateRequestSchema,
  referenceViewResponseSchema,
  teachExerciseResponseSchema,
  type TeachExercise,
} from '@shared/contracts/teach-authoring.ts'

import { TEACH_BODY, TEACH_HEADER, TeachShell } from './teach-shell'

/**
 * `/teach/exercises/new` and `/teach/exercises/:exerciseId` — what the task is,
 * what the student is handed, and whether it is live.
 *
 * The reference circuit is not edited here; it is built on the board, in Learn
 * Mode, and this screen only says whether one exists. Creating an exercise goes
 * straight on to Learn Mode, because an exercise without a reference is an
 * exercise nobody can be scored on.
 *
 * Changing the tray of an exercise that has a reference asks first. The server
 * clears the reference when the tray changes — it was built from the old parts —
 * and a teacher should never discover that from a scores page.
 */

const PART_TYPES: readonly ComponentType[] = ['resistor', 'led', 'capacitor', 'diode', 'transistor', 'jumper']

const TYPE_LABEL: Record<ComponentType, MessageKey> = {
  resistor: 'teach.editor.bom.type.resistor',
  led: 'teach.editor.bom.type.led',
  capacitor: 'teach.editor.bom.type.capacitor',
  diode: 'teach.editor.bom.type.diode',
  transistor: 'teach.editor.bom.type.transistor',
  jumper: 'teach.editor.bom.type.jumper',
  ic: 'teach.editor.bom.type.resistor',
}

const NO_CLASS = 'none'

interface Draft {
  title: string
  objective: string
  difficulty: '1' | '2' | '3' | '4' | '5'
  classId: string
  bom: BomItem[]
}

const EMPTY_DRAFT: Draft = { title: '', objective: '', difficulty: '1', classId: NO_CLASS, bom: [] }

export function ExerciseEditorPage() {
  const t = useT()
  const navigate = useNavigate()
  const { exerciseId } = useParams()
  const isNew = exerciseId === undefined

  const [view, setView] = React.useState<'loading' | 'ready' | 'missing' | 'failed'>(
    isNew ? 'ready' : 'loading',
  )
  const [exercise, setExercise] = React.useState<TeachExercise | null>(null)
  const [components, setComponents] = React.useState(0)
  const [classes, setClasses] = React.useState<ClassSummary[]>([])
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT)
  const [savedBom, setSavedBom] = React.useState<string>('[]')
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [publishing, setPublishing] = React.useState(false)
  const [confirmBom, setConfirmBom] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    api
      .get('/teach/classes', classListResponseSchema)
      .then((response) => {
        if (!cancelled) setClasses(response.items)
      })
      .catch(() => undefined)

    if (exerciseId !== undefined) {
      api
        .get(`/teach/exercises/${exerciseId}/reference`, referenceViewResponseSchema, {
          allowAnswerKey: true,
        })
        .then((response) => {
          if (cancelled) return
          const loaded = response.exercise
          setExercise(loaded)
          setComponents(response.reference?.components ?? 0)
          setDraft({
            title: loaded.title,
            objective: loaded.objective ?? '',
            difficulty: String(loaded.difficulty ?? 1) as Draft['difficulty'],
            classId: loaded.classId ?? NO_CLASS,
            bom: loaded.bom,
          })
          setSavedBom(JSON.stringify(loaded.bom))
          setView('ready')
        })
        .catch((error: unknown) => {
          if (cancelled || (isApiError(error) && error.isUnauthorized)) return
          const missing = isApiError(error) && (error.isNotFound || error.isForbidden || error.status === 400)
          setView(missing ? 'missing' : 'failed')
        })
    }
    return () => {
      cancelled = true
    }
  }, [exerciseId])

  /* ---- the tray ----------------------------------------------------------- */

  const addPart = (type: ComponentType) => {
    setDraft((current) => {
      const taken = new Set(current.bom.map((item) => item.id))
      let n = 1
      while (taken.has(`${type}-${n}`)) n += 1
      const item: BomItem = {
        id: `${type}-${n}`,
        type,
        label: t(TYPE_LABEL[type]),
        value: null,
        quantity: type === 'jumper' ? 4 : 1,
      }
      return { ...current, bom: [...current.bom, item] }
    })
  }

  const updatePart = (id: string, patch: Partial<BomItem>) =>
    setDraft((current) => ({
      ...current,
      bom: current.bom.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }))

  const removePart = (id: string) =>
    setDraft((current) => ({ ...current, bom: current.bom.filter((item) => item.id !== id) }))

  /* ---- saving --------------------------------------------------------------- */

  const payload = () => ({
    title: draft.title,
    objective: draft.objective.trim().length > 0 ? draft.objective : null,
    difficulty: Number(draft.difficulty),
    classId: draft.classId === NO_CLASS ? null : draft.classId,
    bom: draft.bom.map((item) => ({
      ...item,
      label: item.label?.trim() ? item.label.trim() : null,
      value: item.value?.trim() ? item.value.trim() : null,
    })),
  })

  const bomChanged = JSON.stringify(payload().bom) !== savedBom

  const save = async (confirmed = false) => {
    const body = payload()
    const parsed = (isNew ? exerciseCreateRequestSchema : exerciseUpdateRequestSchema).safeParse(body)
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        if (next[key] === undefined) next[key] = issue.message
      }
      setErrors(next)
      toast.warn(t('teach.editor.invalid'))
      return
    }
    setErrors({})

    if (!isNew && exercise?.hasReference && bomChanged && !confirmed) {
      setConfirmBom(true)
      return
    }

    setSaving(true)
    try {
      if (isNew) {
        const created = await api.post('/teach/exercises', teachExerciseResponseSchema, body)
        toast.ok(t('teach.editor.created'))
        navigate(`/teach/exercises/${created.exercise.id}/capture`)
        return
      }

      const updated = await api.patch(`/teach/exercises/${exerciseId}`, teachExerciseResponseSchema, body)
      setExercise(updated.exercise)
      setSavedBom(JSON.stringify(updated.exercise.bom))
      if (updated.referenceCleared) {
        setComponents(0)
        toast.warn(t('teach.editor.referenceCleared'))
      } else {
        toast.ok(t('teach.editor.saved'))
      }
    } catch (error) {
      toast.fault(isApiError(error) ? error.message : t('error.generic'))
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async (published: boolean) => {
    if (exercise === null) return
    setPublishing(true)
    try {
      const response = await api.post(
        `/teach/exercises/${exercise.id}/publish`,
        teachExerciseResponseSchema,
        {
          published,
        },
      )
      setExercise(response.exercise)
      toast.ok(t(published ? 'teach.editor.publish.on' : 'teach.editor.publish.off'))
    } catch (error) {
      toast.fault(
        isApiError(error) && error.status === 409
          ? t('teach.editor.publish.needsReference')
          : t('error.generic'),
      )
    } finally {
      setPublishing(false)
    }
  }

  /* ---- render --------------------------------------------------------------- */

  const title = isNew ? t('teach.editor.newTitle') : (exercise?.title ?? t('teach.editor.crumb'))

  return (
    <TeachShell>
      <PageHeader
        className={TEACH_HEADER}
        breadcrumb={[{ label: t('nav.teach'), to: '/teach' }, { label: t('teach.editor.crumb') }]}
        title={title}
        subtitle={isNew ? t('teach.editor.newSubtitle') : undefined}
      />

      <div className={TEACH_BODY}>
        {view === 'loading' ? <Skeleton className="h-96 rounded-card" /> : null}
        {view === 'missing' ? (
          <EmptyState
            icon={GraduationCap}
            title={t('teach.editor.notFound')}
            action={
              <Button asChild>
                <Link to="/teach">{t('nav.teach')}</Link>
              </Button>
            }
          />
        ) : null}
        {view === 'failed' ? (
          <EmptyState
            icon={GraduationCap}
            title={t('error.generic')}
            description={t('teach.editor.failed')}
          />
        ) : null}

        {view === 'ready' ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <form
              className="flex flex-col gap-6"
              onSubmit={(event) => {
                event.preventDefault()
                void save()
              }}
            >
              <section className="flex flex-col gap-5 rounded-card border border-line bg-bg-800 p-5">
                <Eyebrow marker>{t('teach.editor.details')}</Eyebrow>
                <Input
                  label={t('teach.editor.fields.title')}
                  value={draft.title}
                  error={errors['title']}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                />
                <Textarea
                  label={t('teach.editor.fields.objective')}
                  hint={t('teach.editor.fields.objectiveHint')}
                  value={draft.objective}
                  error={errors['objective']}
                  rows={3}
                  onChange={(event) => setDraft({ ...draft, objective: event.target.value })}
                />
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label={t('teach.editor.fields.difficulty')}>
                    <SegmentedControl
                      fill
                      value={draft.difficulty}
                      onValueChange={(difficulty) => setDraft({ ...draft, difficulty })}
                      options={(['1', '2', '3', '4', '5'] as const).map((level) => ({
                        value: level,
                        label: level,
                      }))}
                    />
                  </Field>
                  <Field label={t('teach.editor.fields.class')}>
                    <Select
                      value={draft.classId}
                      onValueChange={(classId) => setDraft({ ...draft, classId })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_CLASS}>{t('teach.editor.fields.noClass')}</SelectItem>
                        {classes.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </section>

              <section className="rounded-card border border-line bg-bg-800 p-5">
                <Eyebrow marker>{t('teach.editor.bom.title')}</Eyebrow>
                <p className="mt-2 text-sm text-text-secondary">{t('teach.editor.bom.hint')}</p>
                {errors['bom'] ? <p className="mt-2 text-xs text-fault-ink">{errors['bom']}</p> : null}

                {draft.bom.length === 0 ? (
                  <p className="mt-4 text-sm text-text-tertiary">{t('teach.editor.bom.empty')}</p>
                ) : (
                  <ul className="mt-4 flex flex-col gap-3">
                    {draft.bom.map((item) => (
                      <li
                        key={item.id}
                        className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_4.5rem_auto] items-end gap-2"
                        data-testid="bom-row"
                        data-type={item.type}
                      >
                        <Input
                          label={`${t(TYPE_LABEL[item.type])} · ${t('teach.editor.bom.label')}`}
                          value={item.label ?? ''}
                          onChange={(event) => updatePart(item.id, { label: event.target.value })}
                        />
                        <Input
                          label={t('teach.editor.bom.value')}
                          value={item.value ?? ''}
                          placeholder={item.type === 'jumper' ? '—' : undefined}
                          onChange={(event) => updatePart(item.id, { value: event.target.value })}
                        />
                        <Input
                          label={t('teach.editor.bom.quantity')}
                          type="number"
                          min={1}
                          max={64}
                          value={item.quantity}
                          onChange={(event) =>
                            updatePart(item.id, {
                              quantity: Math.max(1, Math.min(64, Number(event.target.value) || 1)),
                            })
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={t('teach.editor.bom.remove', { type: t(TYPE_LABEL[item.type]) })}
                          onClick={() => removePart(item.id)}
                        >
                          <X aria-hidden="true" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {PART_TYPES.map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => addPart(type)}
                    >
                      <Plus aria-hidden="true" />
                      {t(TYPE_LABEL[type])}
                    </Button>
                  ))}
                </div>
              </section>

              <div className="flex justify-end">
                <Button type="submit" loading={saving}>
                  {t(isNew ? 'teach.editor.create' : 'teach.editor.save')}
                </Button>
              </div>
            </form>

            {!isNew && exercise !== null ? (
              <aside className="flex flex-col gap-4">
                <section className="rounded-card border border-line bg-bg-800 p-5">
                  <Eyebrow>{t('teach.editor.reference.title')}</Eyebrow>
                  <div className="mt-3">
                    <StatusBadge tone={exercise.hasReference ? 'ok' : 'warn'}>
                      {t(
                        exercise.hasReference
                          ? 'teach.exercises.status.captured'
                          : 'teach.exercises.status.notCaptured',
                      )}
                    </StatusBadge>
                  </div>
                  <p className="mt-3 text-sm text-text-secondary">
                    {exercise.hasReference
                      ? t('teach.editor.reference.captured', { components })
                      : t('teach.editor.reference.missing')}
                  </p>
                  <Button className="mt-4 w-full" variant="secondary" asChild>
                    <Link to={`/teach/exercises/${exercise.id}/capture`}>
                      <CircuitBoard aria-hidden="true" />
                      {t('teach.editor.reference.open')}
                    </Link>
                  </Button>
                </section>

                <section className="rounded-card border border-line bg-bg-800 p-5">
                  <Eyebrow>{t('teach.editor.publish.title')}</Eyebrow>
                  <label className="mt-3 flex items-center justify-between gap-3 text-sm text-text-primary">
                    {t('teach.editor.publish.label')}
                    <Switch
                      checked={exercise.published}
                      disabled={publishing || (!exercise.published && !exercise.hasReference)}
                      onCheckedChange={(checked) => void togglePublish(checked)}
                    />
                  </label>
                  {!exercise.hasReference ? (
                    <p className="mt-2 text-xs text-text-tertiary">
                      {t('teach.editor.publish.needsReference')}
                    </p>
                  ) : null}
                  <Button className="mt-4 w-full" variant="ghost" asChild>
                    <Link to={`/teach/exercises/${exercise.id}/submissions`}>
                      <BarChart3 aria-hidden="true" />
                      {t('teach.editor.scores')}
                    </Link>
                  </Button>
                </section>

                {bomChanged && exercise.hasReference ? (
                  <Callout tone="warn" title={t('teach.editor.bomChange.title')}>
                    {t('teach.editor.bomChange.body')}
                  </Callout>
                ) : null}
              </aside>
            ) : null}
          </div>
        ) : null}
      </div>

      <Dialog open={confirmBom} onOpenChange={setConfirmBom}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('teach.editor.bomChange.title')}</DialogTitle>
            <DialogDescription>{t('teach.editor.bomChange.body')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">{t('teach.editor.bomChange.cancel')}</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button onClick={() => void save(true)}>{t('teach.editor.bomChange.confirm')}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TeachShell>
  )
}
