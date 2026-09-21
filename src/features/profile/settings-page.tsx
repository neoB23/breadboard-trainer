import { zodResolver } from '@hookform/resolvers/zod'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { AppShell, type AppShellUser } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/layout/page-header'
import {
  Button,
  Callout,
  Card,
  Field,
  Input,
  PasswordInput,
  SectionHeading,
  SegmentedControl,
  Switch,
} from '@/components/ui'
import { useAuthStore } from '@/features/auth/auth-store'
import { applyApiError, type FormFailure } from '@/features/auth/form-errors'
import { useLocale, useLocaleStore, useT, type Locale } from '@/i18n'
import { api } from '@/lib/api'
import { usePreferences, type ThemeSetting } from '@/app/preferences'
import {
  changePasswordRequestSchema,
  changePasswordResponseSchema,
  fullNameSchema,
  optionalTextSchema,
  profileResponseSchema,
  type ProfilePreferences,
} from '@shared/contracts'

/**
 * `/settings`.
 *
 * Four blocks, each an independent form: details, password, language, display.
 * Independent because they fail independently — a wrong current password must
 * not discard a name the person also just edited — and because a single "Save"
 * covering four unrelated concerns is the shape that makes people afraid to
 * touch any of them.
 *
 * ---------------------------------------------------------------------------
 * THE ACCESSIBILITY TOGGLES WRITE TWICE
 *
 * Once to the local `usePreferences` store, which is what actually puts
 * `.reduce-motion` on `<html>` — instantly, so flipping a switch is visible
 * before the network answers. And once to `profiles.preferences`, so the choice
 * follows the student to another lab machine. Phase 1 built the first half and
 * left the second explicitly owed; this is where it is paid.
 *
 * The local write is not rolled back if the server write fails. A setting that
 * snaps back a second after being changed is worse than one that is briefly out
 * of sync, and the next successful save reconciles it.
 * ---------------------------------------------------------------------------
 */
export function SettingsPage() {
  const t = useT()
  const session = useAuthStore((state) => state.session)
  const signOut = useAuthStore((state) => state.signOut)

  const profile = session?.profile
  const user: AppShellUser | undefined = profile
    ? { name: profile.fullName, email: session.user.email, role: profile.role }
    : undefined

  return (
    <AppShell user={user} onSignOut={() => void signOut()}>
      {/* The header spans the shell so its hairline reaches both edges; only its
          contents are constrained. A rule that starts a third of the way across
          the page reads as a rendering fault. */}
      <PageHeader
        className="[&>div]:mx-auto [&>div]:w-full [&>div]:max-w-3xl"
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-14 px-4 py-10 sm:px-6 sm:py-12">
        <DetailsSection />
        <PasswordSection />
        <LanguageSection />
        <DisplaySection />
      </div>
    </AppShell>
  )
}

/* -------------------------------------------------------------------------- */
/* Details                                                                    */
/* -------------------------------------------------------------------------- */

const detailsSchema = z.object({
  fullName: fullNameSchema,
  studentNumber: optionalTextSchema(32),
  section: optionalTextSchema(32),
})
type DetailsForm = z.input<typeof detailsSchema>
type Details = z.output<typeof detailsSchema>

function DetailsSection() {
  const t = useT()
  const locale = useLocale()
  const session = useAuthStore((state) => state.session)
  const patchProfile = useAuthStore((state) => state.patchProfile)

  const [failure, setFailure] = React.useState<FormFailure | null>(null)
  const [saved, setSaved] = React.useState(false)

  const profile = session?.profile

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DetailsForm, unknown, Details>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      fullName: profile?.fullName ?? '',
      studentNumber: profile?.studentNumber ?? '',
      section: profile?.section ?? '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null)
    setSaved(false)

    try {
      const { profile: updated } = await api.patch('/profile', profileResponseSchema, {
        fullName: values.fullName,
        studentNumber: values.studentNumber,
        section: values.section,
      })
      patchProfile(updated)
      setSaved(true)
    } catch (error) {
      setFailure(applyApiError(error, { setError, fields: ['fullName', 'studentNumber', 'section'], locale }))
    }
  })

  return (
    <section>
      <SectionHeading
        eyebrow={t('settings.profile.eyebrow')}
        title={t('settings.profile.title')}
        description={t('settings.profile.description')}
      />

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
        {failure ? <Callout tone="fault">{failure.message}</Callout> : null}
        {saved ? <Callout tone="ok">{t('settings.profile.saved')}</Callout> : null}

        <Input
          label={t('settings.profile.fullName')}
          error={errors.fullName?.message}
          {...register('fullName')}
        />

        {profile?.role === 'student' ? (
          <Input
            label={t('settings.profile.studentNumber')}
            error={errors.studentNumber?.message}
            {...register('studentNumber')}
          />
        ) : null}

        <Input
          label={t('settings.profile.section')}
          optional
          error={errors.section?.message}
          {...register('section')}
        />

        {/* Read-only. Changing the address on an account is an identity change,
            and it needs a confirmation round trip to *both* mailboxes — which is
            a flow, not a field. */}
        <Input
          label={t('settings.profile.email')}
          hint={t('settings.profile.emailHint')}
          value={session?.user.email ?? ''}
          readOnly
          disabled
        />

        <div className="mt-2">
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? t('common.saving') : t('settings.profile.save')}
          </Button>
        </div>
      </form>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Password                                                                   */
/* -------------------------------------------------------------------------- */

const passwordFormSchema = changePasswordRequestSchema
  .safeExtend({ confirm: z.string().min(1) })
  .refine((value) => value.newPassword === value.confirm, {
    path: ['confirm'],
    error: 'Those two do not match.',
  })
type PasswordForm = z.input<typeof passwordFormSchema>
type PasswordValues = z.output<typeof passwordFormSchema>

function PasswordSection() {
  const t = useT()
  const locale = useLocale()

  const [failure, setFailure] = React.useState<FormFailure | null>(null)
  const [saved, setSaved] = React.useState(false)

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm, unknown, PasswordValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null)
    setSaved(false)

    try {
      await api.post('/auth/change-password', changePasswordResponseSchema, {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      // Cleared on success so a shoulder-surfer on a lab machine cannot read the
      // new password off a form that stayed filled in.
      reset({ currentPassword: '', newPassword: '', confirm: '' })
      setSaved(true)
    } catch (error) {
      setFailure(applyApiError(error, { setError, fields: ['currentPassword', 'newPassword'], locale }))
    }
  })

  return (
    <section>
      <SectionHeading
        eyebrow={t('settings.password.eyebrow')}
        title={t('settings.password.title')}
        description={t('settings.password.description')}
      />

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
        {failure ? <Callout tone="fault">{failure.message}</Callout> : null}
        {saved ? <Callout tone="ok">{t('settings.password.saved')}</Callout> : null}

        <PasswordInput
          label={t('settings.password.current')}
          autoComplete="current-password"
          showLabel={t('common.show')}
          hideLabel={t('common.hide')}
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />

        <PasswordInput
          label={t('settings.password.next')}
          autoComplete="new-password"
          showLabel={t('common.show')}
          hideLabel={t('common.hide')}
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />

        <PasswordInput
          label={t('settings.password.confirm')}
          autoComplete="new-password"
          showLabel={t('common.show')}
          hideLabel={t('common.hide')}
          error={errors.confirm?.message}
          {...register('confirm')}
        />

        <div className="mt-2">
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? t('common.saving') : t('settings.password.save')}
          </Button>
        </div>
      </form>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Language                                                                   */
/* -------------------------------------------------------------------------- */

function LanguageSection() {
  const t = useT()
  const locale = useLocale()
  const setLocale = useLocaleStore((state) => state.set)
  const patchProfile = useAuthStore((state) => state.patchProfile)

  const choose = async (next: Locale) => {
    // Local first, so the whole page re-renders in the new language on the same
    // tick. The round trip is what makes the choice follow them elsewhere.
    setLocale(next)

    try {
      const { profile } = await api.patch('/profile', profileResponseSchema, { locale: next })
      patchProfile(profile)
    } catch (error) {
      console.error('[settings] could not save the language preference', error)
    }
  }

  return (
    <section>
      <SectionHeading
        eyebrow={t('settings.language.eyebrow')}
        title={t('settings.language.title')}
        description={t('settings.language.description')}
      />

      <div className="mt-8">
        <SegmentedControl
          label={t('settings.language.title')}
          value={locale}
          onValueChange={(next) => void choose(next)}
          options={[
            { value: 'en', label: t('settings.language.en') },
            { value: 'fil', label: t('settings.language.fil') },
          ]}
        />
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Display and motion                                                         */
/* -------------------------------------------------------------------------- */

function DisplaySection() {
  const t = useT()
  const patchProfile = useAuthStore((state) => state.patchProfile)
  const stored = useAuthStore((state) => state.session?.profile.preferences ?? null)

  const theme = usePreferences((state) => state.theme)
  const highContrast = usePreferences((state) => state.highContrast)
  const reducedMotion = usePreferences((state) => state.reducedMotion)
  const largerText = usePreferences((state) => state.largerText)
  const setLocalPreference = usePreferences((state) => state.set)

  /**
   * Adopts what the server has, once, on first render with a session.
   *
   * This is the half that makes the setting portable: a student who turned on
   * reduced motion at home sees it applied the moment they sign in on a lab
   * machine, without touching a switch. Guarded so it runs on hydration rather
   * than on every save — otherwise it would fight the local write on each toggle.
   */
  const adopted = React.useRef(false)
  React.useEffect(() => {
    if (adopted.current || !stored) return
    adopted.current = true

    setLocalPreference('theme', stored.theme)
    setLocalPreference('highContrast', stored.highContrast)
    setLocalPreference('reducedMotion', stored.reducedMotion)
    setLocalPreference('largerText', stored.largerText)
  }, [stored, setLocalPreference])

  const persist = async (patch: Partial<ProfilePreferences>) => {
    try {
      const { profile } = await api.patch('/profile', profileResponseSchema, { preferences: patch })
      patchProfile(profile)
    } catch (error) {
      // Not rolled back on purpose — see the note at the top of this file.
      console.error('[settings] could not save a display preference', error)
    }
  }

  const toggle = (key: 'highContrast' | 'reducedMotion' | 'largerText', value: boolean) => {
    setLocalPreference(key, value)
    void persist({ [key]: value })
  }

  const rows = [
    {
      key: 'highContrast' as const,
      value: highContrast,
      label: t('settings.access.highContrast'),
      hint: t('settings.access.highContrastHint'),
    },
    {
      key: 'reducedMotion' as const,
      value: reducedMotion,
      label: t('settings.access.reducedMotion'),
      hint: t('settings.access.reducedMotionHint'),
    },
    {
      key: 'largerText' as const,
      value: largerText,
      label: t('settings.access.largerText'),
      hint: t('settings.access.largerTextHint'),
    },
  ]

  return (
    <section>
      <SectionHeading
        eyebrow={t('settings.access.eyebrow')}
        title={t('settings.access.title')}
        description={t('settings.access.description')}
      />

      <div className="mt-8 flex flex-col gap-8">
        <Field label={t('settings.access.theme')}>
          <SegmentedControl
            label={t('settings.access.theme')}
            value={theme}
            onValueChange={(next: ThemeSetting) => {
              setLocalPreference('theme', next)
              void persist({ theme: next })
            }}
            options={[
              { value: 'dark', label: t('settings.access.theme.dark') },
              { value: 'light', label: t('settings.access.theme.light') },
              { value: 'system', label: t('settings.access.theme.system') },
            ]}
          />
        </Field>

        <Card className="divide-y divide-line">
          {rows.map((row) => {
            const id = `preference-${row.key}`
            const labelId = `${id}-label`
            const hintId = `${id}-hint`

            return (
              <div key={row.key} className="flex items-start justify-between gap-6 p-5">
                <div className="min-w-0">
                  {/* A real <label> so tapping the words toggles the switch —
                      that is the target most people aim for on a phone. */}
                  <label
                    id={labelId}
                    htmlFor={id}
                    className="cursor-pointer text-sm font-medium text-text-primary"
                  >
                    {row.label}
                  </label>
                  <p id={hintId} className="mt-1 max-w-prose text-pretty text-xs text-text-tertiary">
                    {row.hint}
                  </p>
                </div>
                {/*
                  `aria-labelledby` as well as the label, and it is not belt and
                  braces. Radix renders the switch as a `<button>`, and while HTML
                  says a button is labelable, browsers do not reliably expose a
                  `<label for>` as a button's accessible name — Chrome announced
                  these three as unnamed, which is how the end-to-end suite found
                  it. Pointing at the label explicitly names them everywhere.
                */}
                <Switch
                  id={id}
                  aria-labelledby={labelId}
                  aria-describedby={hintId}
                  checked={row.value}
                  onCheckedChange={(checked) => toggle(row.key, checked)}
                />
              </div>
            )
          })}
        </Card>
      </div>
    </section>
  )
}
