import { zodResolver } from '@hookform/resolvers/zod'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'

import { Button, Callout, PasswordInput } from '@/components/ui'
import { useLocale, useT } from '@/i18n'
import { api } from '@/lib/api'
import { API_ERROR_CODES, passwordSchema, resetPasswordResponseSchema } from '@shared/contracts'
import { z } from 'zod'

import { AuthLayout } from './auth-layout'
import { applyApiError, type FormFailure } from './form-errors'

/**
 * `/reset-password?token=…`.
 *
 * Four states, and the third is the one that matters: an **expired** link is not
 * the same thing as an invalid one. Expired is recoverable and gets a button
 * that sends another; invalid means the link was mangled or already spent and
 * there is nothing to resend from it. The API keeps them apart with distinct
 * codes (`expired_token` / `invalid_token`) precisely so this screen can.
 *
 * The fourth state is arriving with no token at all — someone typing the URL —
 * which needs its own copy rather than a form that cannot possibly work.
 */

/**
 * Confirmation is a client-only concern: the API takes one password, and asking
 * it to compare two would put a field on the wire that exists purely to catch a
 * typo.
 */
const resetFormSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string().min(1),
  })
  .refine((value) => value.password === value.confirm, {
    path: ['confirm'],
    error: 'Those two do not match.',
  })

type ResetForm = z.infer<typeof resetFormSchema>

export function ResetPasswordPage() {
  const t = useT()
  const locale = useLocale()
  const [params] = useSearchParams()
  const token = params.get('token')

  const [failure, setFailure] = React.useState<FormFailure | null>(null)
  const [done, setDone] = React.useState(false)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { password: '', confirm: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    if (!token) return
    setFailure(null)

    try {
      await api.post('/auth/reset-password', resetPasswordResponseSchema, {
        token,
        password: values.password,
      })
      setDone(true)
    } catch (error) {
      setFailure(applyApiError(error, { setError, fields: ['password'], locale }))
    }
  })

  const signInLink = (
    <Link to="/login" className="rounded-xs text-accent underline-offset-4 hover:underline">
      {t('forgot.backToSignIn')}
    </Link>
  )

  /* ---- no token ---------------------------------------------------------- */

  if (!token) {
    return (
      <AuthLayout
        title={t('reset.missingToken.title')}
        subtitle={t('reset.missingToken.body')}
        footer={signInLink}
      >
        <Button asChild size="lg" className="w-full">
          <Link to="/forgot-password">{t('forgot.submit')}</Link>
        </Button>
      </AuthLayout>
    )
  }

  /* ---- done -------------------------------------------------------------- */

  if (done) {
    return (
      <AuthLayout title={t('reset.done.title')} subtitle={t('reset.done.body')} footer={signInLink}>
        <Button asChild size="lg" className="w-full">
          <Link to="/login">{t('login.submit')}</Link>
        </Button>
      </AuthLayout>
    )
  }

  /* ---- expired ----------------------------------------------------------- */

  if (failure?.code === API_ERROR_CODES.expiredToken) {
    return (
      <AuthLayout title={t('reset.expired.title')} subtitle={t('reset.expired.body')} footer={signInLink}>
        <Button asChild size="lg" className="w-full">
          <Link to="/forgot-password">{t('reset.expired.action')}</Link>
        </Button>
      </AuthLayout>
    )
  }

  /* ---- invalid ----------------------------------------------------------- */

  if (failure?.code === API_ERROR_CODES.invalidToken) {
    return (
      <AuthLayout title={t('reset.invalid.title')} subtitle={t('reset.invalid.body')} footer={signInLink}>
        {/* The action is to start again, not to resend: there is nothing to
            resend from a token that was never valid. */}
        <Button asChild size="lg" className="w-full">
          <Link to="/forgot-password">{t('forgot.submit')}</Link>
        </Button>
      </AuthLayout>
    )
  }

  /* ---- the form ---------------------------------------------------------- */

  return (
    <AuthLayout title={t('reset.title')} subtitle={t('reset.subtitle')} footer={signInLink}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {failure ? <Callout tone="fault">{failure.message}</Callout> : null}

        <PasswordInput
          label={t('reset.password')}
          hint={t('reset.passwordHint')}
          autoComplete="new-password"
          autoFocus
          showLabel={t('common.show')}
          hideLabel={t('common.hide')}
          error={errors.password?.message}
          {...register('password')}
        />

        <PasswordInput
          label={t('reset.confirm')}
          autoComplete="new-password"
          showLabel={t('common.show')}
          hideLabel={t('common.hide')}
          error={errors.confirm?.message ? t('reset.mismatch') : undefined}
          {...register('confirm')}
        />

        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
          {isSubmitting ? t('reset.submitting') : t('reset.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
