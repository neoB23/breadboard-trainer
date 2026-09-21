import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button, Callout, Input, Spinner } from '@/components/ui'
import { useT } from '@/i18n'
import { api, isApiError } from '@/lib/api'
import { API_ERROR_CODES, okSchema, verifyEmailResponseSchema } from '@shared/contracts'

import { AuthLayout } from './auth-layout'

/**
 * `/verify-email?token=…` — the far end of the link in the confirmation email.
 *
 * Five outcomes, each with its own copy, and the ones that would be tempting to
 * collapse are exactly the ones that must not be:
 *
 *   checking  the request is in flight
 *   done      confirmed; sign in
 *   expired   a day has passed — offer a fresh link, which is the whole point
 *             of tracking expiry separately
 *   used      the link already worked once; the account is fine, just sign in
 *   invalid   mangled or forged; there is nothing to resend from it
 *
 * "Expired" and "invalid" look the same to a user and mean opposite things to
 * the product: one is a recoverable state with a button, the other is a dead
 * end. The API keeps them apart with `expired_token` and `invalid_token`, and
 * this screen is the reason it bothers.
 */

type Outcome = 'checking' | 'done' | 'expired' | 'used' | 'invalid'

export function VerifyEmailPage() {
  const t = useT()
  const [params] = useSearchParams()
  const token = params.get('token')

  const [outcome, setOutcome] = React.useState<Outcome>('checking')

  /**
   * The token this component has already sent, so it is never sent twice.
   *
   * StrictMode runs every effect twice in development, and a cleanup flag that
   * only discards the *result* does not help here — the request still goes out,
   * the second one finds the link already spent, and a perfectly good
   * confirmation renders as "already used". The link is single-use by design, so
   * the effect has to be single-fire to match.
   */
  const attempted = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!token || attempted.current === token) return
    attempted.current = token

    const run = async () => {
      try {
        await api.post('/auth/verify-email', verifyEmailResponseSchema, { token })
        setOutcome('done')
      } catch (error) {
        if (!isApiError(error)) return setOutcome('invalid')

        if (error.code === API_ERROR_CODES.expiredToken) return setOutcome('expired')
        if (error.code === API_ERROR_CODES.conflict) return setOutcome('used')
        setOutcome('invalid')
      }
    }

    void run()
  }, [token])

  const signInButton = (
    <Button asChild size="lg" className="w-full">
      <Link to="/login">{t('verify.done.action')}</Link>
    </Button>
  )

  if (!token) {
    return (
      <AuthLayout title={t('verify.missingToken.title')} subtitle={t('verify.missingToken.body')}>
        <div className="mt-2">{signInButton}</div>
      </AuthLayout>
    )
  }

  if (outcome === 'checking') {
    return (
      <AuthLayout title={t('verify.checking.title')} subtitle={t('verify.checking.body')}>
        <Spinner size="sm" label={t('common.loading')} />
      </AuthLayout>
    )
  }

  /**
   * The outcome screens carry no Callout. The page title and the line under it
   * already say the whole message — repeating it in a tinted box two centimetres
   * lower reads as a system that does not trust its own heading. A Callout earns
   * its place where it sits *beside* other content, which on this screen is only
   * the expired state, where a form follows it.
   */
  if (outcome === 'done') {
    return (
      <AuthLayout title={t('verify.done.title')} subtitle={t('verify.done.body')}>
        {signInButton}
      </AuthLayout>
    )
  }

  if (outcome === 'used') {
    return (
      <AuthLayout title={t('verify.used.title')} subtitle={t('verify.used.body')}>
        {signInButton}
      </AuthLayout>
    )
  }

  if (outcome === 'expired') return <ExpiredLink />

  return (
    <AuthLayout title={t('verify.invalid.title')} subtitle={t('verify.invalid.body')}>
      {signInButton}
    </AuthLayout>
  )
}

/* -------------------------------------------------------------------------- */
/* The expired-link state                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The recoverable one.
 *
 * It asks for the address rather than reading it out of the expired token: the
 * token is opaque to the client by design, and decoding it here would mean
 * shipping a JWT parser to do something the server can do safely.
 */
function ExpiredLink() {
  const t = useT()
  const [email, setEmail] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  const resend = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email || sending) return

    setSending(true)
    // The endpoint answers identically for every address, so there is nothing
    // honest to report on failure beyond "we tried".
    await api.post('/auth/resend-verification', okSchema, { email }).catch(() => undefined)
    setSending(false)
    setSent(true)
  }

  return (
    <AuthLayout
      title={t('verify.expired.title')}
      subtitle={t('verify.expired.body')}
      footer={
        <Link to="/login" className="rounded-xs text-accent underline-offset-4 hover:underline">
          {t('forgot.backToSignIn')}
        </Link>
      }
    >
      {sent ? (
        <Callout tone="ok" title={t('verify.expired.sent', { email })} />
      ) : (
        <form onSubmit={resend} noValidate className="flex flex-col gap-5">
          <Input
            label={t('verify.expired.email')}
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <Button type="submit" size="lg" loading={sending} className="mt-2 w-full">
            {t('verify.expired.action')}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
