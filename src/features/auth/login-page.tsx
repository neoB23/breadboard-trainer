import { zodResolver } from '@hookform/resolvers/zod'
import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'

import { TextButton, Button, Callout, Checkbox, Input, PasswordInput } from '@/components/ui'
import { useLocale, useT } from '@/i18n'
import { api } from '@/lib/api'
import {
  API_ERROR_CODES,
  loginRequestSchema,
  loginResponseSchema,
  okSchema,
  type LoginRequest,
} from '@shared/contracts'
import type { z } from 'zod'

import { AuthLayout } from './auth-layout'
import { useAuthStore } from './auth-store'
import { applyApiError, type FormFailure } from './form-errors'
import { homePathFor, useAfterSignInPath } from './route-guards'

/** What the inputs hold, before Zod applies `rememberMe`'s default. */
type LoginForm = z.input<typeof loginRequestSchema>

/**
 * `/login`.
 *
 * The polish list in Phase 3 is short and every item on it is here:
 *
 *   - the submit button shows a spinner and is disabled while in flight, so a
 *     double submit is impossible rather than merely discouraged;
 *   - the password field has a reveal toggle;
 *   - Enter submits from any field, because it is a real `<form>` with a real
 *     submit button rather than a div with a click handler;
 *   - after signing in the user lands on the page they originally asked for;
 *   - errors are sentences.
 *
 * The one deviation from the plan's wording: the failure message does not say
 * "that email isn't registered". Telling an anonymous caller whether an address
 * has an account turns this form into an account-existence oracle, and the API
 * deliberately answers identically for a wrong address and a wrong password.
 */
export function LoginPage() {
  const t = useT()
  const locale = useLocale()
  const navigate = useNavigate()
  const adopt = useAuthStore((state) => state.adopt)

  const [failure, setFailure] = React.useState<FormFailure | null>(null)
  const [resent, setResent] = React.useState(false)

  // Where to go afterwards, captured before the sign-in replaces history.
  const requested = useAfterSignInPath('')

  /**
   * Two type parameters, not one. `LoginRequest` is the schema's *output* —
   * `rememberMe` is a required boolean there because the field carries a
   * `.default(false)`. What the form actually holds is the *input*, where it is
   * optional. Typing the form as the output makes the resolver unassignable, and
   * the usual fix (casting it away) hides the same mismatch at runtime.
   */
  const form = useForm<LoginForm, unknown, LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  })

  const {
    register,
    control,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = form

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null)
    setResent(false)

    try {
      const session = await api.post('/auth/login', loginResponseSchema, values)
      adopt(session)

      /**
       * Onboarding wins over the requested page. Someone who followed a link to
       * an exercise still has to finish setting up first, and `ProtectedRoute`
       * would bounce them there anyway — going straight there avoids a visible
       * double redirect.
       */
      if (session.profile.onboardedAt === null) {
        navigate('/onboarding', { replace: true })
        return
      }

      navigate(requested || homePathFor(session.profile.role), { replace: true })
    } catch (error) {
      setFailure(applyApiError(error, { setError, fields: ['email', 'password'], locale }))
    }
  })

  /** The one recoverable failure on this screen: a confirmed-but-unopened inbox. */
  const unverified = failure?.code === API_ERROR_CODES.emailNotVerified

  const resend = async () => {
    const email = getValues('email')
    if (!email) return
    // Deliberately not surfacing a failure: the endpoint answers identically for
    // every address by design, so there is nothing honest to report.
    await api.post('/auth/resend-verification', okSchema, { email }).catch(() => undefined)
    setResent(true)
  }

  return (
    <AuthLayout
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      footer={
        <span className="flex flex-wrap items-center gap-2">
          {t('login.noAccount')}
          <Link to="/register" className="rounded-xs text-accent underline-offset-4 hover:underline">
            {t('login.register')}
          </Link>
        </span>
      }
    >
      {/* `noValidate` hands validation to Zod: the browser's own bubbles are
          untranslatable and cannot be styled, and they would fire before the
          resolver ever runs. */}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {unverified ? (
          <Callout
            tone="warn"
            title={t('login.unverified.title')}
            action={
              resent ? null : (
                <TextButton type="button" onClick={resend}>
                  {t('login.unverified.resend')}
                </TextButton>
              )
            }
          >
            {resent
              ? t('login.unverified.resent', { email: getValues('email') })
              : t('login.unverified.body', { email: getValues('email') })}
          </Callout>
        ) : failure ? (
          <Callout tone="fault">{failure.message}</Callout>
        ) : null}

        <Input
          label={t('login.email')}
          type="email"
          autoComplete="email"
          // The first thing to fill in, so the cursor starts here.
          autoFocus
          error={errors.email?.message}
          {...register('email')}
        />

        <PasswordInput
          label={t('login.password')}
          autoComplete="current-password"
          showLabel={t('common.show')}
          hideLabel={t('common.hide')}
          error={errors.password?.message}
          {...register('password')}
        />

        {/* Radix reports through onCheckedChange rather than a change event, so
            this one needs a Controller where the text inputs do not. */}
        <Controller
          control={control}
          name="rememberMe"
          render={({ field }) => (
            <Checkbox
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              label={t('login.remember')}
              hint={t('login.rememberHint')}
            />
          )}
        />

        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
          {isSubmitting ? t('login.submitting') : t('login.submit')}
        </Button>

        {/* Under the button rather than beside the checkbox. At this column
            width the two sat on one line only just, and the wrap turned them
            into a pair of stacked links neither of which read as the primary
            path. */}
        <div className="flex justify-center">
          <Link
            to="/forgot-password"
            className="rounded-xs text-sm text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
          >
            {t('login.forgot')}
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}

/** Named export kept for the router; the file is one screen. */
export default LoginPage
