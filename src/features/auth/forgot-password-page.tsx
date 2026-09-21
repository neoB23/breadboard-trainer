import { zodResolver } from '@hookform/resolvers/zod'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

import { Button, Callout, Input } from '@/components/ui'
import { useLocale, useT } from '@/i18n'
import { api } from '@/lib/api'
import {
  forgotPasswordRequestSchema,
  forgotPasswordResponseSchema,
  type ForgotPasswordRequest,
} from '@shared/contracts'

import { AuthLayout } from './auth-layout'
import { applyApiError, type FormFailure } from './form-errors'

/**
 * `/forgot-password`.
 *
 * The endpoint answers `{ ok: true }` whether or not the address is registered,
 * and **the copy on this screen has to match that silence** — "if that address
 * is registered, a link is on its way". Saying "we've sent you a link" would
 * undo the API's discretion with a sentence, because the caller would then know
 * an account exists.
 *
 * The only failure that surfaces here is the rate limiter, which is honest to
 * report: it names a wait rather than a policy, and the person can act on it.
 */
export function ForgotPasswordPage() {
  const t = useT()
  const locale = useLocale()

  const [failure, setFailure] = React.useState<FormFailure | null>(null)
  const [sentTo, setSentTo] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null)
    try {
      await api.post('/auth/forgot-password', forgotPasswordResponseSchema, values)
      setSentTo(values.email)
    } catch (error) {
      setFailure(applyApiError(error, { setError, fields: ['email'], locale }))
    }
  })

  if (sentTo) {
    return (
      <AuthLayout
        title={t('forgot.sent.title')}
        subtitle={t('forgot.sent.body', { email: sentTo })}
        footer={
          <Link to="/login" className="rounded-xs text-accent underline-offset-4 hover:underline">
            {t('forgot.backToSignIn')}
          </Link>
        }
      >
        <Callout tone="ok" title={t('forgot.sent.title')}>
          {t('forgot.sent.body', { email: sentTo })}
        </Callout>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t('forgot.title')}
      subtitle={t('forgot.subtitle')}
      footer={
        <Link to="/login" className="rounded-xs text-accent underline-offset-4 hover:underline">
          {t('forgot.backToSignIn')}
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {failure ? <Callout tone="fault">{failure.message}</Callout> : null}

        <Input
          label={t('forgot.email')}
          type="email"
          autoComplete="email"
          autoFocus
          error={errors.email?.message}
          {...register('email')}
        />

        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
          {isSubmitting ? t('forgot.submitting') : t('forgot.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
