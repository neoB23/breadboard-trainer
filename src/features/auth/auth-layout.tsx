import { CircleCheck, Lightbulb, Users } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { useT } from '@/i18n'

import { Breadboard, NETS } from '@/components/board'

export interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  /** Sign-in / register cross-link, sitting under the form. */
  footer?: React.ReactNode
}

/**
 * The frame every auth screen sits in.
 *
 * ---------------------------------------------------------------------------
 * TWO COLUMNS, AND WHAT EACH IS FOR
 *
 * Left, on white: the form and nothing else. It is the only thing most people
 * came for, it is first in the DOM, and it is the whole screen below `lg`.
 *
 * Right, on the accent: what this tool is. Someone arriving at `/register` from
 * a link in a course page has no idea, and three plain sentences plus a picture
 * of the one idea the product turns on answer that faster than any amount of
 * copy. It is dropped entirely on a phone rather than stacked, because a student
 * on a 360px screen should not have to scroll past an explanation to reach the
 * password field.
 *
 * The blue panel is deliberate. It is the one large area of colour in the app,
 * it appears only on the screens a person sees before they are signed in, and it
 * is what makes this read as a product rather than as an admin form.
 * ---------------------------------------------------------------------------
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const t = useT()

  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg-800 lg:grid-cols-2">
      {/* ---- the form column --------------------------------------------- */}
      <div className="flex min-h-screen flex-col">
        <header className="px-5 pt-6 sm:px-10">
          <Link to="/" className="inline-flex items-center gap-2.5 rounded-md">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent font-display text-sm font-bold text-accent-contrast"
            >
              BT
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-display text-base font-semibold text-text-primary">{t('app.name')}</span>
              <span className="text-sm text-text-tertiary">{t('app.nameSuffix')}</span>
            </span>
          </Link>
        </header>

        <main className="flex flex-1 items-center px-5 py-10 sm:px-10 sm:py-14">
          <div className="w-full max-w-[24rem] sm:mx-auto">
            <h1 className="text-balance font-display text-2xl font-semibold text-text-primary">{title}</h1>

            {subtitle ? <p className="mt-2 text-pretty text-sm text-text-secondary">{subtitle}</p> : null}

            <div className="mt-8">{children}</div>

            {footer ? (
              <div className="mt-8 border-t border-line pt-6 text-sm text-text-secondary">{footer}</div>
            ) : null}
          </div>
        </main>
      </div>

      {/* ---- the aside ---------------------------------------------------- */}
      <aside className="hidden bg-accent lg:flex lg:flex-col lg:justify-center lg:px-12 lg:py-16 xl:px-16">
        <div className="mx-auto w-full max-w-md">
          <h2 className="text-balance font-display text-display-sm font-semibold text-accent-contrast">
            {t('auth.aside.title')}
          </h2>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-accent-contrast/85">
            {t('auth.aside.caption')}
          </p>

          {/* On the accent ground the drawing needs a surface of its own, or
              every hairline in it disappears into the blue. */}
          <div className="mt-8 rounded-card bg-bg-800 p-5 shadow-lg">
            {/*
              The same drawing the landing page animates, held still.
              
              Deliberately static here: this panel sits beside a form somebody is
              typing into, and a looping animation next to a password field is
              a distraction with no upside. All three nets are shown already
              found — there is nothing to reveal, because there is nothing here
              to watch.
            */}
            <Breadboard litNets={NETS.map((net) => net.id)} className="max-w-full" title={t('board.alt')} />

            <ul className="mt-4 border-t border-line pt-3">
              {NETS.map((net) => (
                <li key={net.id} className="flex items-baseline gap-3 py-1 font-mono text-xs">
                  <span className="w-6 shrink-0 font-semibold text-accent">{net.label}</span>
                  <span className="text-text-secondary">{net.members}</span>
                </li>
              ))}
            </ul>
          </div>

          <ul className="mt-8 flex flex-col gap-3">
            {[
              { icon: Lightbulb, text: t('auth.aside.point1') },
              { icon: CircleCheck, text: t('auth.aside.point2') },
              { icon: Users, text: t('auth.aside.point3') },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-accent-contrast/90">
                <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span className="text-pretty">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
