import { zodResolver } from '@hookform/resolvers/zod'
import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

import { TextButton, Button, Callout, Field, Input, PasswordInput, SegmentedControl } from '@/components/ui'
import { useLocale, useT } from '@/i18n'
import { api } from '@/lib/api'
import {
  okSchema,
  registerRequestSchema,
  registerResponseSchema,
  type RegisterRequest,
} from '@shared/contracts'
import type { z } from 'zod'

import { AuthLayout } from './auth-layout'
import { applyApiError, type FormFailure } from './form-errors'

/**
 * What the inputs hold, before Zod turns a blank optional field into an absent
 * one. Typing the form as the schema's *output* makes the resolver unassignable
 * — and the usual fix, casting it away, hides the same mismatch at runtime.
 */
type RegisterForm = z.input<typeof registerRequestSchema>

/** Fields this form actually renders, so an error always has somewhere to land. */
const RENDERED_FIELDS = ['fullName', 'email', 'password', 'studentNumber', 'section', 'inviteCode'] as const

/**
 * `/register`.
 *
 * The two conditional fields are the interesting part. A student must give a
 * student number — the roster is useless without it and asking later never
 * happens — and an instructor must present an invite code, because anyone who
 * can register as faculty can read every golden netlist in the system.
 *
 * Both are enforced by `registerRequestSchema` on this side and again on the
 * server. **The client check is a convenience; the API check is the control.**
 * `assertMayRegisterAs` in `api/auth/registration.ts` is what actually decides,
 * and it fails closed when no code is configured.
 *
 * On success the form is replaced by a "check your email" state rather than a
 * redirect. There is no session yet — `autoSignIn` is off and the address is
 * unconfirmed — so sending them to a sign-in screen that would refuse them is
 * the wrong next step.
 */
export function RegisterPage() {
  const t = useT()
  const locale = useLocale()

  const [failure, setFailure] = React.useState<FormFailure | null>(null)
  const [registered, setRegistered] = React.useState<string | null>(null)

  const form = useForm<RegisterForm, unknown, RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      role: 'student',
      studentNumber: '',
      section: '',
      inviteCode: '',
    },
  })

  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = form

  const role = watch('role')

  const onSubmit = handleSubmit(
    async (values) => {
      setFailure(null)

      /**
       * Sent as validated. `blankAsAbsent` in the contract has already turned a
       * blank optional field into an absent one, which matters most for
       * `inviteCode`: an empty string would arrive as a *present* code and be
       * compared against the real one, producing "that invite code is not valid"
       * on a student registration that never asked for one.
       */
      try {
        const created = await api.post('/auth/register', registerResponseSchema, values)
        setRegistered(created.user.email)
      } catch (error) {
        setFailure(
          applyApiError(error, {
            setError,
            fields: [...RENDERED_FIELDS],
            locale,
          }),
        )
      }
    },
    /**
     * The invalid branch, and it is not decoration.
     *
     * This form changes shape with the role selector, so a field can hold a value
     * that fails validation while not being on screen — and a React Hook Form
     * error on an unrendered field has nowhere to appear. The result is a button
     * that does nothing, which is the worst failure a form can have.
     *
     * `blankAsAbsent` fixed the case that actually bit. This catches the next
     * one: anything that fails on a field this form does not render gets said
     * out loud instead of swallowed.
     */
    (errors) => {
      const homeless = Object.keys(errors).filter(
        (field) => !RENDERED_FIELDS.includes(field as (typeof RENDERED_FIELDS)[number]),
      )
      if (homeless.length === 0) return

      console.error('[register] validation failed on fields this form does not render', errors)
      setFailure({ message: t('error.generic') })
    },
  )

  if (registered) return <CheckEmail email={registered} />

  return (
    <AuthLayout
      title={t('register.title')}
      subtitle={t('register.subtitle')}
      footer={
        <span className="flex flex-wrap items-center gap-2">
          {t('register.haveAccount')}
          <Link to="/login" className="rounded-xs text-accent underline-offset-4 hover:underline">
            {t('register.signIn')}
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {failure ? <Callout tone="fault">{failure.message}</Callout> : null}

        {/* A SegmentedControl rather than a Select: there are two options, the
            form below changes shape depending on which is chosen, and hiding
            that behind a click would make the change look like a glitch. */}
        <Field label={t('register.role')} error={errors.role?.message}>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <SegmentedControl
                fill
                label={t('register.role')}
                value={field.value}
                onValueChange={field.onChange}
                options={[
                  { value: 'student', label: t('register.role.student') },
                  { value: 'instructor', label: t('register.role.instructor') },
                ]}
              />
            )}
          />
        </Field>

        <Input
          label={t('register.fullName')}
          hint={t('register.fullNameHint')}
          autoComplete="name"
          autoFocus
          error={errors.fullName?.message}
          {...register('fullName')}
        />

        <Input
          label={t('register.email')}
          hint={t('register.emailHint')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <PasswordInput
          label={t('register.password')}
          hint={t('register.passwordHint')}
          autoComplete="new-password"
          showLabel={t('common.show')}
          hideLabel={t('common.hide')}
          error={errors.password?.message}
          {...register('password')}
        />

        {role === 'student' ? (
          <>
            <Input
              label={t('register.studentNumber')}
              hint={t('register.studentNumberHint')}
              inputMode="numeric"
              autoComplete="off"
              error={errors.studentNumber?.message}
              {...register('studentNumber')}
            />
            <Input
              label={t('register.section')}
              optional
              autoComplete="off"
              error={errors.section?.message}
              {...register('section')}
            />
          </>
        ) : (
          <Input
            label={t('register.inviteCode')}
            hint={t('register.inviteCodeHint')}
            autoComplete="off"
            className="font-mono tracking-wider"
            error={errors.inviteCode?.message}
            {...register('inviteCode')}
          />
        )}

        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
          {isSubmitting ? t('register.submitting') : t('register.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}

/* -------------------------------------------------------------------------- */
/* After registering                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The state the form becomes on success.
 *
 * Not a route of its own, deliberately: it exists only as the far side of a
 * submit, and a `/check-email` URL would be reachable, bookmarkable and
 * meaningless without the address it is meant to name.
 */
function CheckEmail({ email }: { email: string }) {
  const t = useT()
  const [resent, setResent] = React.useState(false)

  return (
    <AuthLayout
      title={t('checkEmail.title')}
      subtitle={t('checkEmail.body', { email })}
      footer={
        <Link to="/login" className="rounded-xs text-accent underline-offset-4 hover:underline">
          {t('checkEmail.signIn')}
        </Link>
      }
    >
      <div className="flex flex-col gap-6">
        <Callout tone="info" title={t('checkEmail.nothing')}>
          {resent ? t('checkEmail.resent') : null}
        </Callout>

        <div>
          <TextButton
            type="button"
            onClick={async () => {
              await api.post('/auth/resend-verification', okSchema, { email }).catch(() => undefined)
              setResent(true)
            }}
          >
            {t('checkEmail.resend')}
          </TextButton>
        </div>
      </div>
    </AuthLayout>
  )
}
