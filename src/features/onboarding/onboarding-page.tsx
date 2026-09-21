import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, CircleCheck } from 'lucide-react'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { TextButton, Button, Callout, Input, Rule, Stepper, type Step } from '@/components/ui'
import { useLocale, useT } from '@/i18n'
import { api } from '@/lib/api'
import {
  blankAsAbsent,
  fullNameSchema,
  joinClassRequestSchema,
  joinClassResponseSchema,
  JOIN_CODE_LENGTH,
  onboardingResponseSchema,
  sectionSchema,
  studentNumberSchema,
  type JoinClassRequest,
} from '@shared/contracts'

import { useAuthStore } from '@/features/auth/auth-store'
import { applyApiError, type FormFailure } from '@/features/auth/form-errors'
import { homePathFor } from '@/features/auth/route-guards'

/**
 * `/onboarding` — three steps, forced exactly once.
 *
 * ---------------------------------------------------------------------------
 * WHY THE STEPS DO NOT SUBMIT TOGETHER
 *
 * Step 1 is held in local state and posted at the very end; step 2 posts on its
 * own, immediately. That split is deliberate and the contracts spell out why:
 * joining a class has a failure mode — "no class has that code" — that must not
 * roll back the name the student just confirmed. Folding both into one request
 * would mean a mistyped code sends them back to step 1 with an empty form.
 *
 * Which also means `onboarded_at` is stamped by the *last* step. A student who
 * closes the tab halfway through is still un-onboarded and gets the wizard
 * again, which is the correct behaviour for a flow whose whole point is that it
 * completes.
 * ---------------------------------------------------------------------------
 *
 * Instructors get two steps rather than three: they create classes, they do not
 * join them by code.
 */

const identitySchema = z.object({
  fullName: fullNameSchema,
  // Both go through `blankAsAbsent`: an instructor never sees the student-number
  // field, but React Hook Form still submits it as an empty string — and
  // `studentNumberSchema` rejects one, with no rendered field to show the error on.
  studentNumber: blankAsAbsent(studentNumberSchema),
  section: blankAsAbsent(sectionSchema),
})
type IdentityForm = z.input<typeof identitySchema>
type Identity = z.output<typeof identitySchema>

export function OnboardingPage() {
  const t = useT()
  const navigate = useNavigate()
  const profile = useAuthStore((state) => state.session?.profile ?? null)
  const patchProfile = useAuthStore((state) => state.patchProfile)

  const isStudent = profile?.role === 'student'

  const steps: Step[] = React.useMemo(() => {
    const all: Step[] = [
      { id: 'identity', label: t('onboarding.step.identity') },
      { id: 'class', label: t('onboarding.step.class') },
      { id: 'how', label: t('onboarding.step.how') },
    ]
    return isStudent ? all : all.filter((step) => step.id !== 'class')
  }, [isStudent, t])

  const [index, setIndex] = React.useState(0)
  const [identity, setIdentity] = React.useState<Identity | null>(null)
  const [joinedClass, setJoinedClass] = React.useState<string | null>(null)
  const [finishing, setFinishing] = React.useState(false)
  const [failure, setFailure] = React.useState<FormFailure | null>(null)
  const locale = useLocale()

  const current = steps[index]

  const finish = async (values: Identity) => {
    setFinishing(true)
    setFailure(null)

    try {
      const { profile: updated } = await api.post('/profile/onboarding', onboardingResponseSchema, {
        fullName: values.fullName,
        ...(values.studentNumber ? { studentNumber: values.studentNumber } : {}),
        ...(values.section ? { section: values.section } : {}),
      })

      // The store update is what lets `ProtectedRoute` stop redirecting here —
      // it gates on `onboardedAt`, and without this the navigate below bounces
      // straight back to this screen.
      patchProfile(updated)
      navigate(homePathFor(updated.role), { replace: true })
    } catch (error) {
      setFinishing(false)
      setFailure(applyApiError(error, { setError: () => undefined, fields: [], locale }))
    }
  }

  return (
    <div className="min-h-screen bg-bg-900">
      {/* A person mid-wizard is signed in and has no shell around them. The
          wordmark is the one anchor that says which product this is and gives
          them a way back out. */}
      <header className="border-b border-line bg-bg-800 px-5 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent font-display text-xs font-bold text-accent-contrast"
          >
            BT
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-base font-semibold text-text-primary">{t('app.name')}</span>
            <span className="text-sm text-text-tertiary">{t('app.nameSuffix')}</span>
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-6 sm:py-14">
        <Stepper
          className="animate-rise-in"
          steps={steps}
          current={index}
          progressLabel={t('onboarding.stepLabel', { current: index + 1, total: steps.length })}
        />

        <Rule className="mt-8" />

        <div className="stagger-2 mt-10 animate-rise-in">
          {failure ? (
            <Callout tone="fault" className="mb-6">
              {failure.message}
            </Callout>
          ) : null}

          {current?.id === 'identity' ? (
            <IdentityStep
              isStudent={isStudent}
              defaults={{
                fullName: identity?.fullName ?? profile?.fullName ?? '',
                studentNumber: identity?.studentNumber ?? profile?.studentNumber ?? '',
                section: identity?.section ?? profile?.section ?? '',
              }}
              onNext={(values) => {
                setIdentity(values)
                setIndex((step) => step + 1)
              }}
            />
          ) : null}

          {current?.id === 'class' ? (
            <ClassStep
              joined={joinedClass}
              onJoined={setJoinedClass}
              onBack={() => setIndex((step) => step - 1)}
              onNext={() => setIndex((step) => step + 1)}
            />
          ) : null}

          {current?.id === 'how' ? (
            <HowStep
              busy={finishing}
              onBack={() => setIndex((step) => step - 1)}
              onFinish={() => {
                if (identity) void finish(identity)
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Step 1 — identity                                                          */
/* -------------------------------------------------------------------------- */

function IdentityStep({
  isStudent,
  defaults,
  onNext,
}: {
  isStudent: boolean
  defaults: IdentityForm
  onNext: (values: Identity) => void
}) {
  const t = useT()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IdentityForm, unknown, Identity>({
    resolver: zodResolver(
      // An instructor has no student number, so the requirement cannot live on
      // the field itself. The server re-checks against the session role, which
      // is the copy that counts.
      isStudent ? identitySchema.required({ studentNumber: true }) : identitySchema,
    ),
    defaultValues: defaults,
  })

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate className="flex flex-col gap-6">
      {/* No eyebrow: the Stepper directly above already names this step, and
          saying it twice in the same 100px reads as a template rather than a
          composition. */}
      <header className="flex flex-col gap-3">
        <h1 className="text-balance font-display text-display-sm text-text-primary">
          {t('onboarding.identity.title')}
        </h1>
        <p className="max-w-prose text-pretty text-base text-text-secondary">
          {t('onboarding.identity.subtitle')}
        </p>
      </header>

      <Input
        label={t('onboarding.identity.fullName')}
        autoComplete="name"
        autoFocus
        error={errors.fullName?.message}
        {...register('fullName')}
      />

      {isStudent ? (
        <Input
          label={t('onboarding.identity.studentNumber')}
          autoComplete="off"
          error={errors.studentNumber?.message}
          {...register('studentNumber')}
        />
      ) : null}

      <Input
        label={t('onboarding.identity.section')}
        hint={t('onboarding.identity.sectionHint')}
        optional
        autoComplete="off"
        error={errors.section?.message}
        {...register('section')}
      />

      <div className="mt-2 flex justify-end">
        <Button type="submit" size="lg">
          {t('common.continue')}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </form>
  )
}

/* -------------------------------------------------------------------------- */
/* Step 2 — join a class                                                      */
/* -------------------------------------------------------------------------- */

function ClassStep({
  joined,
  onJoined,
  onBack,
  onNext,
}: {
  joined: string | null
  onJoined: (name: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const [failure, setFailure] = React.useState<FormFailure | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<JoinClassRequest>({
    resolver: zodResolver(joinClassRequestSchema),
    defaultValues: { code: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null)
    try {
      const result = await api.post('/classes/join', joinClassResponseSchema, values)
      onJoined(result.class.name)
    } catch (error) {
      /**
       * The Phase 4 DoD: "invalid code shows a helpful error and does not clear
       * the field". Nothing here resets the form — `setError` annotates it and
       * the typed value stays put, so a student who transposed two characters
       * fixes those two characters rather than retyping all six.
       */
      setFailure(applyApiError(error, { setError, fields: ['code'], locale }))
    }
  })

  if (joined) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3">
          <h1 className="text-balance font-display text-display-sm text-text-primary">
            {t('onboarding.class.title')}
          </h1>
        </header>

        <Callout tone="ok" title={t('onboarding.class.joined', { name: joined })} />

        <div className="mt-2 flex items-center justify-between gap-4">
          <TextButton type="button" onClick={onBack}>
            {t('common.back')}
          </TextButton>
          <Button size="lg" onClick={onNext}>
            {t('common.continue')}
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-balance font-display text-display-sm text-text-primary">
          {t('onboarding.class.title')}
        </h1>
        <p className="max-w-prose text-pretty text-base text-text-secondary">
          {t('onboarding.class.subtitle')}
        </p>
      </header>

      {failure ? <Callout tone="fault">{failure.message}</Callout> : null}

      <Input
        label={t('onboarding.class.code')}
        hint={t('onboarding.class.codeHint')}
        autoComplete="off"
        autoCapitalize="characters"
        autoFocus
        maxLength={JOIN_CODE_LENGTH + 2}
        // Mono and wide-tracked: this is a measured value being transcribed off
        // a whiteboard, which is exactly what the mono face is reserved for.
        className="font-mono text-base uppercase tracking-[0.35em]"
        error={errors.code?.message}
        {...register('code')}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <TextButton type="button" onClick={onBack}>
          {t('common.back')}
        </TextButton>
        <Button type="submit" size="lg" loading={isSubmitting}>
          {isSubmitting ? t('onboarding.class.submitting') : t('onboarding.class.submit')}
        </Button>
      </div>

      <Rule className="mt-2" />

      {/* Skippable on purpose. A student who arrives before their instructor has
          made the class must not be stuck on this screen forever. */}
      <div className="flex flex-col gap-2">
        <TextButton type="button" onClick={onNext}>
          {t('onboarding.class.skip')}
        </TextButton>
        <p className="text-xs text-text-tertiary">{t('onboarding.class.skipHint')}</p>
      </div>
    </form>
  )
}

/* -------------------------------------------------------------------------- */
/* Step 3 — how this works                                                    */
/* -------------------------------------------------------------------------- */

function HowStep({ busy, onBack, onFinish }: { busy: boolean; onBack: () => void; onFinish: () => void }) {
  const t = useT()

  const points = [
    { title: t('onboarding.how.point1.title'), body: t('onboarding.how.point1.body') },
    { title: t('onboarding.how.point2.title'), body: t('onboarding.how.point2.body') },
    { title: t('onboarding.how.point3.title'), body: t('onboarding.how.point3.body') },
  ]

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-balance font-display text-display-sm text-text-primary">
          {t('onboarding.how.title')}
        </h1>
        <p className="max-w-prose text-pretty text-base text-text-secondary">
          {t('onboarding.how.subtitle')}
        </p>
      </header>

      <ol className="flex flex-col">
        {points.map((point, index) => (
          <li key={point.title} className="flex gap-5 border-t border-line py-6 first:border-t-0 first:pt-2">
            <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-text-tertiary">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0">
              <h2 className="font-sans text-lg font-medium tracking-tight text-text-primary">
                {point.title}
              </h2>
              <p className="mt-2 max-w-prose text-pretty text-sm text-text-secondary">{point.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <TextButton type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" className="mr-1 size-3" />
          {t('common.back')}
        </TextButton>
        <Button size="lg" loading={busy} onClick={onFinish}>
          {busy ? t('onboarding.how.finishing') : t('onboarding.how.finish')}
          {busy ? null : <CircleCheck aria-hidden="true" />}
        </Button>
      </div>
    </div>
  )
}
