import { ArrowRight } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { BlueprintBackdrop, BoardShowcase, Breadboard, CircuitBackdrop, type NetId } from '@/components/board'
import { AppShell } from '@/components/layout/app-shell'
import { Button, Card, Eyebrow, StatusBadge } from '@/components/ui'
import { useAuthStore } from '@/features/auth/auth-store'
import { homePathFor } from '@/features/auth/route-guards'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * `/` — what this is, for someone who has been handed a link and nothing else.
 *
 * Structure follows the shape a teaching tool's front page actually needs: a
 * blue band that says what it is and offers the two doors in, then white
 * sections that explain the four stages and what is being built. No scrolling
 * marquee, no gradient headline, no motion the reader did not ask for.
 */
export function LandingPage() {
  const t = useT()

  // The primary action changes for someone already signed in: sending them to a
  // sign-in form they do not need is the most common way a landing page wastes
  // a returning visitor's click.
  const status = useAuthStore((state) => state.status)
  const role = useAuthStore((state) => state.session?.profile.role ?? null)
  const signedIn = status === 'authenticated'

  /**
   * The four stages, each paired with the board state that *is* that stage.
   *
   * The crop windows are chosen so the relevant part of the circuit fills the
   * card: build and extract look at the resistor end, compare and diagnose at the
   * LED and the channel where the fault lives.
   */
  const steps = React.useMemo(
    () => [
      {
        index: '1',
        title: t('landing.step.build.title'),
        body: t('landing.step.build.body'),
        // Parts seated, nothing wired and nothing read yet.
        crop: { columns: [0, 12], band: 'upper' } as const,
        placed: 2,
        litNets: [] as NetId[],
        focusedNet: null,
        fault: false,
        faultedNet: null,
      },
      {
        index: '2',
        title: t('landing.step.extract.title'),
        body: t('landing.step.extract.body'),
        // The columns bond into nets: five holes, one node.
        crop: { columns: [0, 12], band: 'upper' } as const,
        placed: 3,
        litNets: ['n1', 'n2'] as NetId[],
        focusedNet: null,
        fault: true,
        faultedNet: null,
      },
      {
        index: '3',
        title: t('landing.step.compare.title'),
        body: t('landing.step.compare.body'),
        // One net picked out and named, the way the readout does it.
        crop: { columns: [0, 12], band: 'upper' } as const,
        placed: 3,
        litNets: ['n1', 'n2', 'n3'] as NetId[],
        focusedNet: 'n2' as NetId,
        fault: true,
        faultedNet: null,
      },
      {
        index: '4',
        title: t('landing.step.diagnose.title'),
        body: t('landing.step.diagnose.body'),
        // The fault, in the fault colour, at the channel it straddles.
        crop: { columns: [7, 18], band: 'channel' } as const,
        placed: 3,
        litNets: ['n1', 'n2', 'n3'] as NetId[],
        focusedNet: null,
        fault: true,
        faultedNet: 'n3' as NetId,
      },
    ],
    [t],
  )

  /** Specification, not achievement: these describe the thing being built. */
  const spec = React.useMemo(
    () => [
      { value: '3D', label: t('landing.spec.workspace'), detail: t('landing.spec.workspaceDetail') },
      { value: '830', label: t('landing.spec.tiePoints'), detail: t('landing.spec.tiePointsDetail') },
      { value: 'MNA', label: t('landing.spec.solver'), detail: t('landing.spec.solverDetail') },
      { value: 'AA', label: t('landing.spec.contrast'), detail: t('landing.spec.contrastDetail') },
    ],
    [t],
  )

  return (
    <AppShell>
      {/* ---- hero ---------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden bg-accent">
        <CircuitBackdrop />

        {/* `relative`, so the content sits above the backdrop rather than under
            it — the backdrop is absolutely positioned across the whole band. */}
        <div className="relative mx-auto grid w-full max-w-shell grid-cols-1 items-center gap-x-12 gap-y-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h1 className="text-balance font-display text-display font-semibold text-accent-contrast sm:text-display-lg">
              {t('landing.headline.1')} {t('landing.headline.2a')} {t('landing.headline.2b')}
              {t('landing.headline.2c')} {t('landing.headline.3')}
            </h1>

            <p className="mt-5 max-w-prose text-pretty text-base leading-relaxed text-accent-contrast/90">
              {t('landing.lead')}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {/* On the blue band the primary action inverts: a white button on
                  accent is the strongest contrast available and needs no border. */}
              <Button
                size="lg"
                asChild
                className="bg-bg-800 text-accent shadow-md hover:bg-bg-800/90 active:bg-bg-800/90"
              >
                <Link to={signedIn ? homePathFor(role) : '/login'}>
                  {signedIn ? t('nav.dashboard') : t('landing.cta.signIn')}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>

              {signedIn ? null : (
                <Button
                  size="lg"
                  variant="secondary"
                  asChild
                  className="border-accent-contrast/40 bg-transparent text-accent-contrast shadow-none hover:border-accent-contrast hover:bg-accent-contrast/10"
                >
                  <Link to="/register">{t('landing.cta.register')}</Link>
                </Button>
              )}
            </div>
          </div>

          {/*
            The demonstration, not a picture of one. It builds the branch, sweeps
            the board, reads three nets off it and names the one that is missing —
            which is the product in nine seconds. It holds still under
            `.reduce-motion` and stops when scrolled past; see BoardShowcase.
          */}
          <BoardShowcase className="self-center lg:col-span-5" />
        </div>
      </section>

      {/* ---- how it works -------------------------------------------------- */}
      <section id="how-it-works" className="relative isolate scroll-mt-16 overflow-hidden">
        <BlueprintBackdrop />

        <div className="relative mx-auto w-full max-w-shell px-4 py-20 sm:px-6 sm:py-24">
          {/* Centred, unlike the app's own screens. A front page is read like a
              page; a workspace is scanned like a tool, and those want different
              alignment. */}
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow className="justify-center">{t('landing.how.eyebrow')}</Eyebrow>
            <h2 className="mt-3 text-balance font-display text-display font-semibold text-text-primary">
              {t('landing.how.title')}
            </h2>
            <p className="mt-4 text-pretty text-lg leading-relaxed text-text-secondary">
              {t('landing.how.description')}
            </p>
          </div>

          {/*
            Each step SHOWS its stage rather than describing it.

            The four stages of the product are four states this component already
            renders, so the section that explains them can be the thing itself:
            parts going down, nets lighting up, one net focused, the fault named.
            Four identical cards with a number in a circle explained nothing that
            the heading above them had not already said.

            Two columns rather than four. At a quarter of the shell each board is
            a smudge, and a picture nobody can read is worse than no picture.
          */}
          <ol className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {steps.map((step) => (
              <li key={step.index}>
                <Card interactive className="h-full overflow-hidden">
                  {/*
                    One fixed box for all four, so the cards align across the
                    grid. The bands have different aspect ratios — a crop of the
                    upper bank is squarer than one across the channel — and
                    letting each set its own height leaves the titles at four
                    different heights, which is the thing that makes a grid look
                    unconsidered. The SVG letterboxes inside it.
                  */}
                  <div className="flex aspect-[8/5] items-center justify-center border-b border-line bg-bg-900 p-4">
                    <Breadboard
                      crop={step.crop}
                      placed={step.placed}
                      litNets={step.litNets}
                      focusedNet={step.focusedNet}
                      fault={step.fault}
                      faultedNet={step.faultedNet}
                      className="size-full"
                    />
                  </div>

                  <div className="flex gap-4 p-6">
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-accent/10 font-display text-base font-semibold text-accent"
                    >
                      {step.index}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-xl font-semibold text-text-primary">{step.title}</h3>
                      <p className="mt-2 text-pretty text-sm leading-relaxed text-text-secondary">
                        {step.body}
                      </p>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- specification -------------------------------------------------- */}
      {/*
        A spec plate, not four numbers floating on grey.

        The hairline rules between the columns are doing the work: they turn four
        independent stats into one table, which is how a datasheet prints the same
        information and why this reads as specification rather than as marketing.
        `divide-x` only from `sm`, because at one column a vertical rule between
        stacked rows would be nonsense.
      */}
      <section className="relative isolate overflow-hidden border-y border-line bg-bg-900">
        <BlueprintBackdrop cell={48} fade="none" />

        <div className="relative mx-auto w-full max-w-shell px-4 py-16 sm:px-6">
          <Eyebrow marker>{t('landing.spec.eyebrow')}</Eyebrow>

          <dl className="mt-10 grid grid-cols-2 gap-y-10 sm:grid-cols-4 sm:gap-y-0 sm:divide-x sm:divide-line">
            {spec.map((item, index) => (
              <div key={item.label} className={cn('px-0', index > 0 && 'sm:pl-8', 'sm:pr-8')}>
                <dt className="font-display text-display font-semibold tracking-tight text-accent">
                  {item.value}
                </dt>
                <dd className="mt-2">
                  <span className="block text-base font-medium text-text-primary">{item.label}</span>
                  <span className="mt-1 block text-sm text-text-secondary">{item.detail}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-shell px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 py-10">
          <p className="max-w-prose text-sm text-text-secondary">{t('landing.footer.note')}</p>
          <StatusBadge tone="info">{t('landing.footer.badge')}</StatusBadge>
        </div>
      </footer>
    </AppShell>
  )
}
