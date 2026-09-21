import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  History,
  Layers,
  Search,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { BlueprintBackdrop, Breadboard, type NetId } from '@/components/board'
import { AppNavItem, AppShell, type AppShellUser } from '@/components/layout/app-shell'
import {
  Badge,
  Button,
  Card,
  Chip,
  DifficultyMeter,
  EmptyState,
  Eyebrow,
  Input,
  Progress,
  ProgressRing,
  Rule,
  SectionHeading,
  Skeleton,
  StatusBadge,
  type BadgeTone,
} from '@/components/ui'
import { useAuthStore } from '@/features/auth/auth-store'
import { useLocale, useT, type MessageKey, type TranslateFn } from '@/i18n'
import { api, isApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  classListResponseSchema,
  exerciseListResponseSchema,
  type AssignedExercise,
  type ClassSummary,
  type ExerciseStatus,
} from '@shared/contracts'

import {
  actionFor,
  classProgress,
  completionRatio,
  filterLibrary,
  firstName,
  formatDay,
  formatToday,
  groupActivity,
  orderForLibrary,
  pickNext,
  tally,
  type ActivityDay,
  type ExerciseAction,
  type Totals as LibraryTotals,
} from './library'

/**
 * `/dashboard` — the student's home.
 *
 * ---------------------------------------------------------------------------
 * THREE COLUMNS, AND WHAT EACH ONE IS FOR
 *
 * The screen used to be one column of full-width bands, which is the shape a
 * dashboard gets by default and the shape that wastes a wide lab monitor
 * hardest: a student on a 1440px screen scrolled past four sections to reach
 * the list of their own exercises.
 *
 * It is now read left to right, and each column answers a different question.
 *
 *   rail (left)    Who am I and how far through am I. One ring, one figure,
 *                  and the name the instructor sees on the roster.
 *   main (centre)  What do I do now. The classes, the one exercise to open,
 *                  and the complete list beneath it.
 *   rail (right)   What have I been doing. Attempts, newest first, by day.
 *
 * Below `xl` the two rails fold into the flow — the left one into the shell's
 * navigation overlay, the right one to the bottom of the page — so the phone
 * layout is the same three answers in the same order, stacked.
 *
 * ---------------------------------------------------------------------------
 * DESIGNED FOR ONE EXERCISE, AND FOR TWELVE
 *
 * A seeded student is enrolled in one class holding one published exercise, and
 * that is also what a real student sees in week one. A three-across grid of
 * exercise cards showing a single card looks broken, and it is the default shape
 * a dashboard gets built in.
 *
 * So the screen leads with **one** thing — the exercise to start or resume,
 * given the whole width and a picture of the board it builds — and everything
 * else is a list underneath that reads correctly at length one. Adding a second
 * exercise changes nothing about the layout; it adds a row.
 *
 * The list is not optional. An earlier version of this screen showed the
 * featured exercise and the class cards and nothing else, which meant a student
 * with six assigned exercises could reach one of them: fine for a demo, useless
 * by week six. The featured row is marked in the list rather than removed from
 * it, so the list is always the complete set.
 * ---------------------------------------------------------------------------
 *
 * Every number here is read from the API. There is no invented "completion over
 * time", no streak and no estimated minutes remaining, because no endpoint
 * produces one — and a dashboard whose figures cannot be traced to a response
 * is decoration a student will eventually catch out. What the screen *decides*
 * lives in `./library.ts`, where it can be tested without a DOM.
 */

/**
 * The window onto the board, and how much of it is lit.
 *
 * One fixed crop rather than a per-exercise one. Varying it by id was the first
 * attempt and it was wrong: half the exercises landed on the channel band, which
 * holds the LED and nothing else, so the card carried a picture of an almost
 * empty board.
 *
 * The second attempt cropped to the upper bank, which was wrong in a more
 * interesting way — it cut the LED in half. The circuit runs from the top rail
 * at column 2, across the resistor, *through the centre channel* at column 12
 * and back to the bottom rail, so any horizontal band that reads as a circuit
 * has to contain both banks. This one does, and the columns are trimmed to the
 * part of the board the circuit actually occupies.
 *
 * What does vary is the lighting, and it varies with something real: an exercise
 * you have finished shows its nets bonded, one you have not shows a bare board.
 */
function boardFor(exercise: AssignedExercise): { litNets: NetId[] } {
  return { litNets: exercise.progress.status === 'completed' ? ['n1', 'n2', 'n3'] : [] }
}

const DASHBOARD_CROP = { columns: [1, 17], band: 'full' } as const

/**
 * The rail's ornament: a wide, shallow strip of the upper bank.
 *
 * Cropped to a band rather than to columns alone. Nine columns of the *whole*
 * board is a portrait sliver of mostly empty holes — which is precisely the
 * shape `BoardCrop`'s own note says a card cannot show — and in a 190px rail it
 * ran the height of the page.
 */
const RAIL_CROP = { columns: [1, 9], band: 'upper' } as const

/**
 * Status to badge, in one place.
 *
 * `StatusBadge` carries a distinct icon shape per tone, so these read correctly
 * in greyscale and under every dichromacy the styleguide simulates — which is
 * the whole reason the status is a badge rather than a coloured dot.
 */
const STATUS_BADGE: Record<ExerciseStatus, { tone: BadgeTone; key: MessageKey }> = {
  not_started: { tone: 'neutral', key: 'dashboard.status.notStarted' },
  in_progress: { tone: 'info', key: 'dashboard.status.inProgress' },
  completed: { tone: 'ok', key: 'dashboard.status.completed' },
}

/**
 * The same three states as a rule down the left edge of a row.
 *
 * A second encoding of something the badge beside it already says, which is the
 * point: the bar is what lets the eye find the unfinished half of a twenty-row
 * list without reading any of it, and the badge is what makes the bar
 * interpretable the first time. Neither is load-bearing alone.
 */
const STATUS_RULE: Record<ExerciseStatus, string> = {
  not_started: 'bg-line',
  in_progress: 'bg-info',
  completed: 'bg-ok',
}

const ACTION_LABEL: Record<ExerciseAction, MessageKey> = {
  start: 'dashboard.library.start',
  resume: 'dashboard.next.resume',
  review: 'dashboard.library.review',
}

const ROLE_LABEL: Record<AppShellUser['role'], MessageKey> = {
  student: 'role.student',
  instructor: 'role.instructor',
  admin: 'role.admin',
}

const STAGGER = ['stagger-1', 'stagger-2', 'stagger-3', 'stagger-4', 'stagger-5', 'stagger-6'] as const

/* -------------------------------------------------------------------------- */
/* Class card colour                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Three tinted skins, taken in turn.
 *
 * The layout this screen is modelled on gives each card a saturated fill and
 * white type. That does not survive a theme swap — every one of these tokens
 * inverts on dark, and white-on-token would fail contrast on half of them — so
 * each card takes its tone's `-surface` / `-line` / `-ink` trio instead, the
 * same trio a badge takes. The result is a card that is unmistakably *coloured*
 * and still legible in both themes, at high contrast, and in greyscale.
 *
 * The colour is an index, not a meaning: it separates one class from the next in
 * a row of three and carries nothing a student has to decode. That is why the
 * semantic tones a status could be confused with — `fault` above all — are not
 * in the rotation.
 */
type ClassTone = 'info' | 'ok' | 'warn'

const CLASS_TONES: readonly ClassTone[] = ['info', 'ok', 'warn']

const CLASS_SKIN: Record<ClassTone, { card: string; ink: string; grid: string; glow: string }> = {
  info: {
    card: 'border-info-line bg-info-surface',
    ink: 'text-info-ink',
    grid: 'text-info-ink/20',
    glow: 'bg-info/20',
  },
  ok: {
    card: 'border-ok-line bg-ok-surface',
    ink: 'text-ok-ink',
    grid: 'text-ok-ink/20',
    glow: 'bg-ok/20',
  },
  warn: {
    card: 'border-warn-line bg-warn-surface',
    ink: 'text-warn-ink',
    grid: 'text-warn-ink/20',
    glow: 'bg-warn/20',
  },
}

/* -------------------------------------------------------------------------- */
/* The screen                                                                 */
/* -------------------------------------------------------------------------- */

export function DashboardPage() {
  const t = useT()
  const locale = useLocale()
  const session = useAuthStore((state) => state.session)
  const signOut = useAuthStore((state) => state.signOut)

  const [classes, setClasses] = React.useState<ClassSummary[] | null>(null)
  const [exercises, setExercises] = React.useState<AssignedExercise[] | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [query, setQuery] = React.useState('')

  // The search field lives with the list it filters; the button up in the
  // greeting row only points at it. A control that filters something a screen
  // away is a control people use once.
  const searchRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    let cancelled = false

    /**
     * Both lists at once. They are independent, and fetching them in sequence
     * would make the slower one decide when the screen appears.
     */
    Promise.all([
      api.get('/classes', classListResponseSchema),
      api.get('/exercises', exerciseListResponseSchema, { query: { perPage: 50 } }),
    ])
      .then(([classResult, exerciseResult]) => {
        if (cancelled) return
        setClasses(classResult.items)
        setExercises(exerciseResult.items)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        // A 401 is the session expiring; the route guard is already handling it,
        // so there is nothing for this screen to say about it.
        if (!isApiError(error) || !error.isUnauthorized) setFailed(true)
        setClasses([])
        setExercises([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  const profile = session?.profile
  const user: AppShellUser | undefined = profile
    ? { name: profile.fullName, email: session.user.email, role: profile.role }
    : undefined

  const loading = classes === null || exercises === null
  const totals = exercises ? tally(exercises) : null
  const next = exercises ? pickNext(exercises) : null
  const library = React.useMemo(() => (exercises ? orderForLibrary(exercises) : []), [exercises])
  const activity = React.useMemo(
    () => (exercises ? groupActivity(exercises, locale) : []),
    [exercises, locale],
  )

  return (
    <AppShell
      user={user}
      onSignOut={() => void signOut()}
      sidebar={<YouPanel user={user} totals={totals} />}
      nav={
        <>
          <AppNavItem to="/dashboard">{t('nav.dashboard')}</AppNavItem>
          <AppNavItem to="/sandbox">{t('nav.sandbox')}</AppNavItem>
          <AppNavItem to="/settings">{t('nav.settings')}</AppNavItem>
        </>
      }
    >
      <div className="mx-auto w-full max-w-shell px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <Greeting
          name={firstName(profile?.fullName ?? '')}
          date={formatToday(new Date(), locale)}
          searchable={library.length > 3}
          onSearch={() => {
            searchRef.current?.scrollIntoView({ block: 'center' })
            searchRef.current?.focus()
          }}
        />

        {failed ? (
          <Card className="mt-8 p-5">
            <p className="text-sm text-text-secondary">{t('error.generic')}</p>
          </Card>
        ) : null}

        {/* ---- the classes, across the top ---------------------------------- */}
        <ClassStrip classes={classes} library={library} loading={loading} />

        {/* Two columns, each a stack, rather than four cells in a two-by-two
            grid. The grid version tied the counts to the height of the hero
            beside them and left a hand's width of nothing above the activity
            rail; a column simply stacks, and the rail closes up. */}
        <div className="mt-8 flex flex-col gap-6 xl:flex-row xl:items-start">
          {/* The centre column, and the first thing in the document: what to
              open now, then everything that was ever assigned. */}
          <div className="flex min-w-0 flex-1 flex-col gap-8">
            {loading ? (
              <NextSkeleton />
            ) : next ? (
              <NextExercise exercise={next} />
            ) : exercises && exercises.length > 0 ? (
              <AllDone count={exercises.length} />
            ) : (
              <NoExercises hasClass={(classes?.length ?? 0) > 0} />
            )}

            {loading ? (
              <section>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-5 h-56 rounded-card" />
              </section>
            ) : library.length > 0 ? (
              <Library
                exercises={library}
                featuredId={next?.id ?? null}
                query={query}
                onQueryChange={setQuery}
                searchRef={searchRef}
              />
            ) : null}
          </div>

          {/* The right rail: the counts, then the history. Both are readings of
              the same list the centre column is showing, which is why they sit
              after it in the document rather than beside it. */}
          <div className="flex w-full min-w-0 flex-col gap-6 xl:w-80 xl:shrink-0">
            {loading ? (
              <Skeleton className="h-52 rounded-card" />
            ) : totals && totals.assigned > 0 ? (
              <Totals totals={totals} />
            ) : null}

            {loading ? (
              <Skeleton className="h-64 rounded-card" />
            ) : library.length > 0 ? (
              <Activity days={activity} />
            ) : null}
          </div>
        </div>

        {/* ---- enrolment, when there is none yet ---------------------------- */}
        {!loading && (classes?.length ?? 0) === 0 ? (
          <section className="mt-12">
            <SectionHeading eyebrow={t('dashboard.classes.eyebrow')} title={t('dashboard.classes.title')} />
            <div className="mt-5">
              <EmptyState
                icon={GraduationCap}
                title={t('dashboard.classes.empty')}
                description={t('dashboard.classes.emptyDescription')}
                action={
                  <Button asChild>
                    <Link to="/settings">{t('dashboard.classes.join')}</Link>
                  </Button>
                }
              />
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  )
}

/* -------------------------------------------------------------------------- */
/* The greeting row                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Name, date, and the two controls that are not about any one exercise.
 *
 * The `PageHeader` band that used to open this screen is gone. It drew a
 * full-width rule under a title reading "Your dashboard", above a screen the
 * navigation had already labelled Dashboard — and the rule cut the page in half
 * before it had said anything. A greeting sitting directly on the page ground,
 * with today's date under it, is the whole of what that band was for.
 */
function Greeting({
  name,
  date,
  searchable,
  onSearch,
}: {
  name: string
  date: string
  searchable: boolean
  onSearch: () => void
}) {
  const t = useT()

  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <h1 className="text-balance font-display text-display-sm font-semibold text-text-primary">
          {t('dashboard.greeting', { name })}
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">{t('dashboard.today', { date })}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {searchable ? (
          <Button variant="secondary" size="icon" aria-label={t('dashboard.search.jump')} onClick={onSearch}>
            <Search />
          </Button>
        ) : null}
        <Button asChild>
          <Link to="/sandbox">
            <Sparkles aria-hidden="true" />
            {t('dashboard.action.freeBuild')}
          </Link>
        </Button>
      </div>
    </header>
  )
}

/* -------------------------------------------------------------------------- */
/* The rail: who you are, and how far through                                 */
/* -------------------------------------------------------------------------- */

/**
 * The one place on the screen that is about the person rather than the work.
 *
 * The ring is the dashboard's single loud element, and it is spent here on the
 * figure a student actually wants at a glance. Everything below it is quiet by
 * comparison, which is what stops a screen holding three coloured cards from
 * having no focal point at all.
 *
 * The completion is written out in words as well — "2 of 6 exercises finished"
 * — because a ring is a shape, and a shape is not a number.
 */
function YouPanel({ user, totals }: { user?: AppShellUser; totals: LibraryTotals | null }) {
  const t = useT()

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="size-24 rounded-pill" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-40" />
      </div>
    )
  }

  const percent = totals ? Math.round(completionRatio(totals) * 100) : 0
  const initials = initialsOf(user.name)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center text-center">
        <ProgressRing value={percent} size={96} thickness={4}>
          <span className="flex size-full items-center justify-center rounded-pill bg-accent/10 font-display text-xl font-semibold text-accent">
            {initials}
          </span>
        </ProgressRing>

        {/* Pinned to the ring the way a charge badge is pinned to an avatar: the
            figure belongs to the ring, so it sits on it rather than under it. */}
        <span className="relative -mt-3 rounded-pill border border-line bg-bg-800 px-2 py-0.5 font-mono text-xs font-medium tabular-nums text-text-primary shadow-sm">
          {percent}%
        </span>

        <p className="mt-3 w-full truncate font-display text-base font-semibold text-text-primary">
          {user.name}
        </p>
        <p className="w-full truncate font-mono text-xs text-text-tertiary">{user.email}</p>

        <Badge tone="neutral" className="mt-3">
          {t(ROLE_LABEL[user.role])}
        </Badge>
      </div>

      <Rule />

      <p className="text-pretty text-sm text-text-secondary">
        {totals && totals.assigned > 0
          ? t('dashboard.you.completedOf', { completed: totals.completed, assigned: totals.assigned })
          : t('dashboard.you.noneAssigned')}
      </p>

      <Button variant="secondary" size="sm" className="w-full" asChild>
        <Link to="/settings">
          <Settings aria-hidden="true" />
          {t('dashboard.classes.manage')}
        </Link>
      </Button>

      {/* The product's one drawing, at ornament size. Four columns is too few to
          read as a circuit and exactly enough to read as a board, which is all a
          rail wants — and it is hidden in the navigation overlay, where the
          space belongs to the links. */}
      <div className="mt-2 hidden flex-col gap-4 lg:flex">
        <Rule />
        <div className="opacity-60">
          <Breadboard crop={RAIL_CROP} litNets={['n1']} className="w-full" />
        </div>
        <p className="text-pretty text-xs leading-relaxed text-text-tertiary">{t('app.tagline')}</p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* The classes, as a strip                                                    */
/* -------------------------------------------------------------------------- */

function ClassStrip({
  classes,
  library,
  loading,
}: {
  classes: ClassSummary[] | null
  library: AssignedExercise[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-44 rounded-card" />
        <Skeleton className="h-44 rounded-card" />
        <Skeleton className="hidden h-44 rounded-card xl:block" />
      </div>
    )
  }

  if (!classes || classes.length === 0) return null

  const alone = classes.length === 1

  return (
    <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {classes.map((joined, index) => (
        <li
          key={joined.id}
          className={cn(
            'animate-rise-in',
            STAGGER[index % STAGGER.length],
            alone && 'sm:col-span-2 xl:col-span-2',
          )}
        >
          <ClassCard
            joined={joined}
            tone={CLASS_TONES[index % CLASS_TONES.length] as ClassTone}
            progress={classProgress(library, joined.id)}
            wide={alone}
          />
        </li>
      ))}
    </ul>
  )
}

/**
 * One class, as a coloured block.
 *
 * Three things a student uses this card for, in the order they reach for them:
 * which class it is, how far through it they are, and the join code they have
 * to read out to a classmate. Everything else — the roster count, the term — is
 * annotation, and is sized like it.
 *
 * The hole grid behind it is the board's own pitch, the same pattern the landing
 * page draws at a hairline's opacity. Here it is the card's texture, and it is
 * the one ornament in the product that could not belong to any other app.
 */
function ClassCard({
  joined,
  tone,
  progress,
  wide = false,
}: {
  joined: ClassSummary
  tone: ClassTone
  progress: { assigned: number; completed: number }
  /** The card has been given two columns because it is the only one. */
  wide?: boolean
}) {
  const t = useT()
  const skin = CLASS_SKIN[tone]

  return (
    <div
      className={cn('relative isolate flex h-full flex-col overflow-hidden rounded-card border', skin.card)}
    >
      <HoleGrid className={skin.grid} />
      {/* A single soft bloom in the corner, so a flat tint reads as lit rather
          than as a swatch. One per card; two would be weather. */}
      <div
        aria-hidden="true"
        className={cn('absolute -right-10 -top-12 size-36 rounded-full blur-2xl', skin.glow)}
      />

      {/* Held to a measure when the card is wide. A line of text and a
          progress bar both stop being readable somewhere around 40em, and a
          2/6 bar drawn across the full width of a banner reads as a design
          that expected more classes than the student has. */}
      <div className={cn('relative flex flex-1 flex-col p-5', wide && 'max-w-xl')}>
        <div className="flex items-start justify-between gap-3">
          <span
            aria-hidden="true"
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-pill border border-line bg-bg-800/70 font-display text-xs font-bold',
              skin.ink,
            )}
          >
            {initialsOf(joined.instructorName)}
          </span>

          <span className={cn('flex items-center gap-1.5 text-xs font-medium', skin.ink)}>
            <Users aria-hidden="true" className="size-3.5" />
            <span className="tabular-nums">{joined.studentCount}</span>
            <span className="sr-only">{t('dashboard.class.students')}</span>
          </span>
        </div>

        <h3 className={cn('mt-4 text-balance font-display text-display-xs font-semibold', skin.ink)}>
          {joined.name}
        </h3>
        <p className="mt-1 truncate text-sm text-text-secondary">{joined.instructorName}</p>

        {/* Counted from this student's own exercise list rather than read off the
            class's published count — the two answer different questions, and a
            card reading "3 of 6" beside a list of five is how you notice. */}
        <div className="mt-auto pt-5">
          {progress.assigned > 0 ? (
            <Progress
              tone={tone}
              weight="bar"
              value={Math.round((progress.completed / progress.assigned) * 100)}
              label={t('dashboard.class.progress')}
              readout={`${progress.completed} / ${progress.assigned}`}
            />
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <Layers aria-hidden="true" className="size-3.5" />
              {t('dashboard.class.exercises')}
              <span className="tabular-nums">{joined.exerciseCount}</span>
            </p>
          )}
        </div>
      </div>

      {/* Mono, because it is transcribed. A join code is the one string on this
          screen where an O and a 0 have to be told apart. */}
      <div className="relative flex items-center gap-2 border-t border-line px-5 py-3">
        <span className="text-xs text-text-tertiary">{t('dashboard.class.code')}</span>
        <code className="rounded-xs bg-bg-800/70 px-2 py-0.5 font-mono text-sm tracking-wider text-text-primary">
          {joined.code}
        </code>
        {joined.term ? (
          <span className="ml-auto truncate text-xs text-text-tertiary">{joined.term}</span>
        ) : null}
      </div>
    </div>
  )
}

/** "Prof. Amelia Reyes" -> "AR". Two letters, the way a roster shows them. */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter((part) => !/^(prof\.?|dr\.?|engr\.?|mr\.?|ms\.?|mrs\.?)$/i.test(part))
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/**
 * The board's pitch, as a texture.
 *
 * A `<pattern>` rather than a repeating CSS gradient, for the same reason
 * `BlueprintBackdrop` uses one: the cell is stated once and stays square at
 * every viewport. It fills with `currentColor`, so the caller tints it with a
 * text utility and the tint follows the theme for free.
 */
function HoleGrid({ className }: { className?: string }) {
  // A generated id carries colons, which are legal in an id and awkward
  // everywhere else. Stripped, and still unique per instance.
  const id = `holes-${React.useId().replace(/:/g, '')}`

  return (
    <svg
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 size-full', className)}
      style={{
        maskImage: 'linear-gradient(to bottom left, black, transparent 62%)',
        WebkitMaskImage: 'linear-gradient(to bottom left, black, transparent 62%)',
      }}
    >
      <defs>
        <pattern id={id} width={12} height={12} patternUnits="userSpaceOnUse">
          <circle cx={6} cy={6} r={1.25} fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* Up next                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The one thing the screen is for: what to open now.
 *
 * Given the full width of the centre column and a picture of the board, because
 * a student with ten minutes before a lab should not have to choose. The board
 * illustration is the same component the landing page and the auth aside use —
 * the product's one drawing, doing a third job.
 *
 * It is held still. The landing hero is the only thing in the product that
 * animates on its own, and it earns that by being the explanation; a workspace
 * screen that redraws itself while you read it is only harder to read.
 */
function NextExercise({ exercise }: { exercise: AssignedExercise }) {
  const t = useT()
  const resuming = exercise.progress.openAttemptId !== null
  const board = boardFor(exercise)

  return (
    <section className="relative isolate animate-rise-in overflow-hidden rounded-panel border border-line bg-bg-800 shadow-sm">
      <BlueprintBackdrop cell={24} fade="none" />

      <div className="relative grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
        <div className="relative flex items-center justify-center overflow-hidden border-b border-line bg-bg-900 p-6 lg:border-b-0 lg:border-r">
          {/* The bloom sits behind the drawing rather than on it: a board is a
              physical object, and the light in the picture should look like it
              came from the LED. */}
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl"
          />
          {/* No fixed aspect box. `preserveAspectRatio` letterboxes a viewBox
              inside a box of a different shape, and with the crop clipped those
              margins are blank — so the drawing sets its own height from the
              window it was given, and the panel is whatever tall that is. */}
          <div className="relative w-full max-w-sm">
            <Breadboard crop={DASHBOARD_CROP} litNets={board.litNets} className="w-full" />
          </div>
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow marker>
              {resuming ? t('dashboard.next.resumeEyebrow') : t('dashboard.next.eyebrow')}
            </Eyebrow>
            {exercise.progress.status === 'in_progress' ? (
              <StatusBadge tone="info">{t('dashboard.status.inProgress')}</StatusBadge>
            ) : null}
          </div>

          <h2 className="mt-3 text-balance font-display text-display-sm font-semibold text-text-primary">
            {exercise.title}
          </h2>

          {exercise.objective ? (
            <p className="mt-3 max-w-prose text-pretty text-base leading-relaxed text-text-secondary">
              {exercise.objective}
            </p>
          ) : null}

          {/* The bill of materials, as the tray will present it. Reading the
              parts list before opening the workspace is how a student knows
              whether they have ten minutes or forty. */}
          {exercise.bom.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-2">
              {exercise.bom.map((item) => (
                <li key={item.id}>
                  <Chip>
                    {item.quantity > 1 ? `${item.quantity} × ` : ''}
                    {item.label ?? item.type}
                    {item.value ? ` · ${item.value}` : ''}
                  </Chip>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <Link to={`/lab/${exercise.id}`}>
                {resuming ? t('dashboard.next.resume') : t('dashboard.next.start')}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>

            {exercise.difficulty !== null ? <DifficultyBadge level={exercise.difficulty} t={t} /> : null}

            {exercise.progress.attemptCount > 0 ? (
              <span className="text-sm text-text-tertiary">
                {t('dashboard.next.attempts', { count: exercise.progress.attemptCount })}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Pips and the sentence they stand for, in one pill.
 *
 * The meter carries the accessible name and the text beside it is `aria-hidden`,
 * rather than the other way round: that way there is exactly one reading of it,
 * whether or not you can see the bars.
 */
function DifficultyBadge({ level, t }: { level: number; t: TranslateFn }) {
  return (
    <Badge tone="neutral" className="gap-2">
      <DifficultyMeter size="sm" level={level} label={t('dashboard.next.difficulty', { level })} />
      <span aria-hidden="true">{t('dashboard.next.difficulty', { level })}</span>
    </Badge>
  )
}

function NextSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-panel border border-line lg:grid-cols-2">
      <Skeleton className="aspect-square rounded-none" />
      <div className="flex flex-col justify-center gap-4 p-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-11 w-40 rounded-pill" />
      </div>
    </div>
  )
}

function AllDone({ count }: { count: number }) {
  const t = useT()
  return (
    <EmptyState
      icon={BookOpen}
      eyebrow={t('dashboard.next.eyebrow')}
      title={t('dashboard.allDone.title')}
      description={t('dashboard.allDone.description', { count })}
    />
  )
}

function NoExercises({ hasClass }: { hasClass: boolean }) {
  const t = useT()
  return (
    <EmptyState
      icon={BookOpen}
      eyebrow={t('dashboard.next.eyebrow')}
      title={hasClass ? t('dashboard.noExercises.title') : t('dashboard.noClass.title')}
      description={hasClass ? t('dashboard.noExercises.description') : t('dashboard.noClass.description')}
      action={
        hasClass ? null : (
          <Button asChild>
            <Link to="/settings">{t('dashboard.classes.join')}</Link>
          </Button>
        )
      }
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Totals                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Three counts and the ratio they add up to, all derived from the list already
 * fetched.
 *
 * Hairline rules between the figures rather than three floating numbers, which
 * is the same move the landing page's specification band makes: it reads as one
 * figure with three parts rather than as a metrics dashboard. The bar underneath
 * is `completed / assigned` as it stands right now — not progress over time,
 * which nothing here can honestly produce.
 *
 * Each figure takes the colour its own state takes everywhere else on the
 * screen: the in-progress count is `info` because the in-progress badge is, and
 * because the row rule for an in-progress exercise is. Three uses of one colour
 * for one meaning is a system; three colours chosen to look nice is a palette.
 */
function Totals({ totals }: { totals: LibraryTotals }) {
  const t = useT()

  const rows: { value: number; label: string; ink: string }[] = [
    { value: totals.assigned, label: t('dashboard.totals.assigned'), ink: 'text-text-primary' },
    { value: totals.inProgress, label: t('dashboard.totals.inProgress'), ink: 'text-info-ink' },
    { value: totals.completed, label: t('dashboard.totals.completed'), ink: 'text-ok-ink' },
  ]

  return (
    <section className="stagger-1 animate-rise-in">
      <Eyebrow marker>{t('dashboard.progress.eyebrow')}</Eyebrow>

      <div className="mt-3 overflow-hidden rounded-card border border-line bg-bg-800">
        <dl className="grid grid-cols-3 divide-x divide-line">
          {rows.map((row) => (
            <div key={row.label} className="min-w-0 px-3 py-4">
              <dt className={cn('font-display text-display-sm font-semibold tabular-nums', row.ink)}>
                {row.value}
              </dt>
              {/* Wraps rather than truncates. A label reading "Complet…" is a
                  figure nobody can name, which is the whole of what a tile is
                  for. */}
              <dd className="mt-1.5 text-pretty text-xs leading-tight text-text-secondary">{row.label}</dd>
            </div>
          ))}
        </dl>

        <div className="border-t border-line px-4 py-4">
          <Progress
            value={Math.round(completionRatio(totals) * 100)}
            label={t('dashboard.totals.progress')}
            readout={`${totals.completed} / ${totals.assigned}`}
          />
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* The library                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Everything assigned, in the order there is something to be done about it.
 *
 * A list of rows rather than a grid of cards. Six cards three-across is two full
 * rows and a hole where the seventh would be; six rows is six rows, at any
 * count, at any width. It also lets the eye compare titles down one column
 * instead of scanning a plaid.
 *
 * No board thumbnail per row, deliberately. The drawing needs its pitch to read
 * as a board, and at row height every hole collapses to a smudge — the same
 * reason `BoardCrop` takes a window rather than a scale factor.
 *
 * The search field appears once the list is long enough to be worth narrowing.
 * Rendering it above three rows would be a control whose only honest use is to
 * turn three rows into two.
 */
function Library({
  exercises,
  featuredId,
  query,
  onQueryChange,
  searchRef,
}: {
  exercises: AssignedExercise[]
  featuredId: string | null
  query: string
  onQueryChange: (value: string) => void
  searchRef: React.RefObject<HTMLInputElement | null>
}) {
  const t = useT()
  const shown = React.useMemo(() => filterLibrary(exercises, query), [exercises, query])
  const searchable = exercises.length > 3

  return (
    <section>
      <SectionHeading
        eyebrow={t('dashboard.library.eyebrow')}
        title={t('dashboard.library.title')}
        description={t('dashboard.library.description')}
        action={
          searchable ? (
            <div className="w-full sm:w-60">
              <Input
                ref={searchRef}
                type="search"
                value={query}
                leadingIcon={<Search />}
                aria-label={t('dashboard.search.label')}
                placeholder={t('dashboard.search.placeholder')}
                onChange={(event) => onQueryChange(event.target.value)}
              />
            </div>
          ) : null
        }
      />

      {shown.length > 0 ? (
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-card border border-line bg-bg-800">
          {shown.map((exercise) => (
            <li key={exercise.id}>
              <ExerciseRow exercise={exercise} featured={exercise.id === featuredId} />
            </li>
          ))}
        </ul>
      ) : (
        // Not an `EmptyState`: nothing has gone wrong and nothing needs starting
        // — the query is simply too narrow. One line, and the way back out.
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-dashed border-line px-5 py-6">
          <p className="text-sm text-text-secondary">{t('dashboard.search.empty', { query })}</p>
          <Button variant="secondary" size="sm" onClick={() => onQueryChange('')}>
            {t('dashboard.search.clear')}
          </Button>
        </div>
      )}
    </section>
  )
}

function ExerciseRow({ exercise, featured }: { exercise: AssignedExercise; featured: boolean }) {
  const t = useT()
  const locale = useLocale()

  const status = STATUS_BADGE[exercise.progress.status]
  const action = actionFor(exercise)
  const parts = exercise.bom.reduce((total, item) => total + item.quantity, 0)
  const lastOpened = exercise.progress.lastAttemptAt
    ? formatDay(exercise.progress.lastAttemptAt, locale)
    : null

  return (
    <div className="relative flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-bg-900 sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-5">
      {/* The row also shown at the top of the page is marked, not hidden — a
          list that quietly omits a row is a list you cannot count. Everything
          else takes its own status colour, which is what lets the eye find the
          unfinished half of a long list without reading any of it. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-2 left-0 w-0.5 rounded-pill',
          featured ? 'bg-accent' : STATUS_RULE[exercise.progress.status],
        )}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="font-medium text-text-primary">{exercise.title}</h3>
          <StatusBadge tone={status.tone}>{t(status.key)}</StatusBadge>
          {featured ? <Eyebrow>{t('dashboard.next.eyebrow')}</Eyebrow> : null}
        </div>

        {exercise.objective ? (
          <p className="mt-1 line-clamp-1 text-sm text-text-secondary">{exercise.objective}</p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-tertiary">
          {/* The word as well as the bars. Pips alone in a row of metadata are a
              shape nobody has been taught to read yet; beside their own noun
              they are read once and scanned thereafter. */}
          {exercise.difficulty !== null ? (
            <span className="flex items-center gap-2">
              <span aria-hidden="true">{t('dashboard.library.difficulty')}</span>
              <DifficultyMeter
                level={exercise.difficulty}
                label={t('dashboard.next.difficulty', { level: exercise.difficulty })}
              />
            </span>
          ) : null}

          <span className="flex items-center gap-1.5">
            <Layers aria-hidden="true" className="size-3.5" />
            {t('dashboard.library.parts')}
            <span className="font-medium tabular-nums text-text-secondary">{parts}</span>
          </span>

          {lastOpened ? (
            <span className="flex items-center gap-1.5">
              <History aria-hidden="true" className="size-3.5" />
              {t('dashboard.library.lastOpened', { date: lastOpened })}
            </span>
          ) : null}
        </div>
      </div>

      {/* Secondary, all of them. The screen already has its one primary action
          at the top, and eight primary buttons is none. */}
      <div className="shrink-0">
        <Button variant="secondary" size="sm" asChild>
          <Link to={`/lab/${exercise.id}`} aria-label={`${t(ACTION_LABEL[action])} — ${exercise.title}`}>
            {t(ACTION_LABEL[action])}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Activity                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The last few things this student opened, by day.
 *
 * The layout this screen is modelled on puts a calendar here. This app has no
 * calendar — nothing schedules an exercise, nothing carries a due date, and a
 * rail of invented appointments would be the single most convincing lie on the
 * page. What it does have is `progress.lastAttemptAt` on every exercise, which
 * is a real timeline of real work and wants exactly the shape a calendar wants:
 * a day heading, a time, a coloured rule, a title.
 *
 * One entry per exercise, being the last time it was touched, because that is
 * the only granularity the API offers. See `groupActivity`.
 */
function Activity({ days }: { days: ActivityDay[] }) {
  const t = useT()

  return (
    <section className="stagger-2 animate-rise-in">
      <Eyebrow marker>{t('dashboard.activity.eyebrow')}</Eyebrow>

      <div className="mt-3 rounded-card border border-line bg-bg-800 p-5">
        <h2 className="font-display text-lg font-semibold text-text-primary">
          {t('dashboard.activity.title')}
        </h2>

        {days.length === 0 ? (
          <p className="mt-3 text-pretty text-sm text-text-secondary">{t('dashboard.activity.empty')}</p>
        ) : (
          <div className="mt-5 flex flex-col gap-5">
            {days.map((day) => (
              <div key={day.key}>
                <p className="text-micro font-semibold uppercase text-text-tertiary">{day.label}</p>

                <ul className="mt-2.5 flex flex-col gap-3">
                  {day.entries.map((entry) => (
                    <li key={entry.exercise.id} className="flex items-stretch gap-3">
                      <span className="w-10 shrink-0 pt-px font-mono text-xs tabular-nums text-text-secondary">
                        {entry.time}
                      </span>

                      {/* The rule is the status, in the same three colours the
                          list rows use — so the rail and the list agree without
                          the rail having to repeat a badge. */}
                      <span
                        aria-hidden="true"
                        className={cn(
                          'w-0.5 shrink-0 rounded-pill',
                          STATUS_RULE[entry.exercise.progress.status],
                        )}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="text-micro uppercase text-text-tertiary">
                          {t(STATUS_BADGE[entry.exercise.progress.status].key)}
                        </p>
                        <Link
                          to={`/lab/${entry.exercise.id}`}
                          className="mt-0.5 block rounded-sm text-sm font-medium text-text-primary transition-colors hover:text-accent"
                        >
                          {entry.exercise.title}
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
