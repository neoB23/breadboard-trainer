import {
  ArrowUpRight,
  BookOpen,
  Copy,
  Download,
  EyeOff,
  FolderOpen,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { BoardShowcase, BoardStage, Breadboard, NETS } from '@/components/board'
import { AppNavItem, AppShell } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/layout/page-header'
import {
  Badge,
  TextButton,
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Chip,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DifficultyMeter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Eyebrow,
  Field,
  Input,
  PasswordInput,
  Progress,
  ProgressRing,
  Rule,
  SegmentedControl,
  SectionHeading,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Spinner,
  Stepper,
  StatBlock,
  StatusBadge,
  Switch,
  Textarea,
  toast,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type BadgeTone,
  type SegmentedOption,
} from '@/components/ui'
import { cn } from '@/lib/utils'

import {
  Panel,
  Section,
  SectionNav,
  Specimen,
  SpecimenGrid,
  Swatch,
  ThemeSplit,
  useActiveSection,
  type NavGroup,
} from './section'
import { parseVisionMode, VisionFilters, VisionPicker, visionStyle, type VisionMode } from './vision-filter'

/**
 * Tailwind scans source as plain text, so every class it has to emit must exist
 * here written out in full. That is the only reason these tables carry literal
 * class strings instead of composing them from the token name — never build a
 * utility with a template literal.
 */

const GROUNDS = [
  { name: 'bg-900', className: 'bg-bg-900', note: 'the page' },
  { name: 'bg-800', className: 'bg-bg-800', note: 'surfaces' },
  { name: 'bg-700', className: 'bg-bg-700', note: 'raised · muted' },
  { name: 'bg-600', className: 'bg-bg-600', note: 'strong edge' },
]

const EDGES = [
  { name: 'line', className: 'bg-line', note: 'the default hairline' },
  { name: 'line-strong', className: 'bg-line-strong', note: 'hover · firm edge' },
  { name: 'accent', className: 'bg-accent', note: 'the whole colour budget' },
  { name: 'accent-ink', className: 'bg-accent-ink', note: 'pressed, on light' },
  { name: 'accent-contrast', className: 'bg-accent-contrast', note: 'ink on the accent' },
]

const INK = [
  { name: 'text-primary', className: 'text-text-primary' },
  { name: 'text-secondary', className: 'text-text-secondary' },
  { name: 'text-tertiary', className: 'text-text-tertiary' },
]

interface ToneSpecimen {
  tone: BadgeTone
  /** Fits inside a half-width theme pane. */
  short: string
  example: string
  ramp: string[]
}

const TONES: ToneSpecimen[] = [
  {
    tone: 'ok',
    short: 'Correct',
    example: 'Circuit correct',
    ramp: ['bg-ok', 'bg-ok-surface', 'bg-ok-line', 'bg-ok-ink'],
  },
  {
    tone: 'warn',
    short: 'Loose',
    example: 'Loose contact',
    ramp: ['bg-warn', 'bg-warn-surface', 'bg-warn-line', 'bg-warn-ink'],
  },
  {
    tone: 'fault',
    short: 'Short',
    example: 'Short to ground',
    ramp: ['bg-fault', 'bg-fault-surface', 'bg-fault-line', 'bg-fault-ink'],
  },
  {
    tone: 'info',
    short: 'Hint',
    example: 'Hint available',
    ramp: ['bg-info', 'bg-info-surface', 'bg-info-line', 'bg-info-ink'],
  },
  {
    tone: 'neutral',
    short: 'Idle',
    example: 'Not started',
    ramp: ['bg-neutral', 'bg-neutral-surface', 'bg-neutral-line', 'bg-neutral-ink'],
  },
]

const DISPLAY_SCALE = [
  { name: 'display-xl', size: '76px', className: 'text-display-xl', sample: 'Ohm' },
  { name: 'display-lg', size: '56px', className: 'text-display-lg', sample: 'Rail' },
  { name: 'display', size: '40px', className: 'text-display', sample: 'Voltage divider' },
  { name: 'display-sm', size: '28px', className: 'text-display-sm', sample: 'Voltage divider' },
  { name: 'display-xs', size: '22px', className: 'text-display-xs', sample: 'Voltage divider' },
]

const UI_SCALE = [
  { name: 'lg', size: '17px', className: 'text-lg' },
  { name: 'base', size: '15px', className: 'text-base' },
  { name: 'sm', size: '13px', className: 'text-sm' },
  { name: 'xs', size: '12px', className: 'text-xs' },
  { name: 'micro', size: '11px', className: 'text-micro uppercase' },
]

const RADII = [
  { name: 'rounded-xs', className: 'rounded-xs', note: 'checkbox · menu row · tooltip' },
  { name: 'rounded-card', className: 'rounded-card', note: 'card · dropdown · toast' },
  { name: 'rounded-panel', className: 'rounded-panel', note: 'dialog · empty state' },
  { name: 'rounded-pill', className: 'rounded-pill', note: 'every interactive control' },
]

const ELEVATION = [
  { name: 'hairline', className: 'border border-line', note: 'anything sitting on the page' },
  { name: 'shadow-sm', className: 'border border-line shadow-sm', note: 'a nudge, rarely needed' },
  { name: 'shadow-md', className: 'border border-line shadow-md', note: 'tooltip' },
  { name: 'shadow-lg', className: 'border border-line shadow-lg', note: 'dialog · dropdown · toast' },
]

/**
 * Pseudo-states cannot be shown statically, so each variant carries the exact
 * classes its `hover:` rules apply. Keep these in step with button.tsx — a
 * drifted column here is worse than no column at all.
 */
const BUTTON_VARIANTS = [
  { variant: 'primary', hover: '-translate-y-px bg-accent-ink dark:bg-accent/85' },
  { variant: 'secondary', hover: 'border-line-strong bg-bg-700' },
  { variant: 'ghost', hover: 'bg-bg-800 text-text-primary' },
  { variant: 'danger', hover: 'bg-fault-ink' },
  { variant: 'link', hover: 'underline' },
] as const

/**
 * index.css offsets the global ring against the page ground; inside a panel the
 * offset has to name that panel's ground instead or the halo reads as a gap.
 */
const FOCUS_RING = 'ring-2 ring-ring ring-offset-2 ring-offset-bg-800'

const FACETS = [
  { id: 'faults', label: 'Faults', count: 24 },
  { id: 'analog', label: 'Analog', count: 12 },
  { id: 'digital', label: 'Digital', count: 8 },
  { id: 'unsolved', label: 'Unsolved', count: 3 },
]

const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Foundations',
    items: [
      { id: 'colour', label: 'Colour' },
      { id: 'states', label: 'States' },
      { id: 'type', label: 'Type' },
      { id: 'shape', label: 'Shape' },
      { id: 'motion', label: 'Motion' },
    ],
  },
  {
    label: 'Signature',
    items: [
      { id: 'signature', label: 'Page furniture' },
      { id: 'board', label: 'Breadboard' },
    ],
  },
  {
    label: 'Controls',
    items: [
      { id: 'button', label: 'Button' },
      { id: 'chip', label: 'Chip' },
      { id: 'input', label: 'Input' },
      { id: 'password', label: 'Password' },
      { id: 'textarea', label: 'Textarea' },
      { id: 'select', label: 'Select' },
      { id: 'segmented', label: 'Segmented' },
      { id: 'checkbox', label: 'Checkbox' },
      { id: 'switch', label: 'Switch' },
    ],
  },
  {
    label: 'Feedback',
    items: [
      { id: 'badge', label: 'Badge' },
      { id: 'callout', label: 'Callout' },
      { id: 'progress', label: 'Progress' },
      { id: 'difficulty', label: 'Difficulty' },
      { id: 'stepper', label: 'Stepper' },
      { id: 'toast', label: 'Toast' },
      { id: 'tooltip', label: 'Tooltip' },
      { id: 'spinner', label: 'Spinner' },
      { id: 'skeleton', label: 'Skeleton' },
    ],
  },
  {
    label: 'Surfaces',
    items: [
      { id: 'card', label: 'Card' },
      { id: 'dialog', label: 'Dialog' },
      { id: 'menu', label: 'Menu' },
      { id: 'empty', label: 'Empty state' },
      { id: 'layout', label: 'Page header' },
    ],
  },
]

const SECTION_IDS = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.id))

/**
 * Renders every primitive in every state it can be in.
 *
 * This page is the standing contract for the design system: if a component is
 * not here, it does not exist. It is also the system's own showpiece — a style
 * guide that reads as a test harness is evidence the language does not hold up,
 * so the page is composed to the same rules it documents.
 */
export function StyleguidePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const vision = parseVisionMode(searchParams.get('vision'))
  const activeId = useActiveSection(SECTION_IDS)

  // Remounting the block restarts every entrance animation on it at once.
  const [motionKey, setMotionKey] = React.useState(0)
  const [facets, setFacets] = React.useState<string[]>(['faults'])

  const setVision = (next: VisionMode) => {
    // Kept in the URL so a simulation can be linked, screenshotted or handed to
    // a reviewer, rather than only existing while someone holds the dropdown.
    setSearchParams(next === 'normal' ? {} : { vision: next }, { replace: true })
  }

  const toggleFacet = (id: string) =>
    setFacets((current) => (current.includes(id) ? current.filter((f) => f !== id) : [...current, id]))

  return (
    <TooltipProvider delayDuration={200}>
      <VisionFilters />
      <AppShell
        user={{ name: 'Ada Reyes', email: 'ada.reyes@example.edu', role: 'instructor' }}
        nav={
          <>
            <AppNavItem to="/" end>
              Overview
            </AppNavItem>
            <AppNavItem to="/styleguide">Style guide</AppNavItem>
          </>
        }
      >
        <PageHeader
          id="top"
          className="mx-auto w-full max-w-shell"
          title="Every primitive, every state"
          subtitle="The source of truth for the design language: the tokens that compile, the five semantic states, and the components built on them. Change a primitive and change this page in the same commit."
          breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Style guide' }]}
          action={<VisionPicker value={vision} onChange={setVision} />}
        />

        <div className="mx-auto flex w-full max-w-shell gap-10 px-4 pb-32 sm:px-6 xl:gap-16">
          <SectionNav groups={NAV_GROUPS} activeId={activeId} />

          <div className="min-w-0 flex-1" style={visionStyle(vision)}>
            {/* The system's own numbers, set in the primitive that renders every
                other summary strip in the app. */}
            <div className="grid grid-cols-2 gap-8 rounded-card border border-line bg-bg-800 px-6 py-6 sm:grid-cols-4">
              <StatBlock value="19" label="Primitives" detail="modules in src/components/ui" />
              <StatBlock value="5" label="State tones" detail="each with its own silhouette" />
              <StatBlock value="4" label="Radii" detail="xs · card · panel · pill" />
              <StatBlock
                value="1"
                label="Chromatic colour"
                detail="everything else is a grey"
                tone="accent"
              />
            </div>

            {/* ---------------------------------------------------------- */}
            {/* Foundations                                                */}
            {/* ---------------------------------------------------------- */}

            <Section
              id="colour"
              eyebrow="Foundations"
              title="Colour"
              description="Tailwind's stock palette is replaced rather than extended, so bg-red-500 does not compile at all. Every colour below resolves through a variable in tokens.css — including the accent, which changes hue between themes and must never be written as a literal."
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <Panel label="Grounds" note="900 → 600">
                  <div className="flex flex-col gap-4">
                    {GROUNDS.map((item) => (
                      <Swatch key={item.name} {...item} />
                    ))}
                  </div>
                </Panel>

                <Panel label="Rules & accent" note="hairlines, not shadows">
                  <div className="flex flex-col gap-4">
                    {EDGES.map((item) => (
                      <Swatch key={item.name} {...item} />
                    ))}
                  </div>
                </Panel>

                <Panel label="Ink" note="three weights, one inverse">
                  <div className="flex flex-col gap-4">
                    {INK.map((item) => (
                      <div key={item.name} className="flex flex-col gap-1">
                        <code className="font-mono text-xs text-text-tertiary">{item.name}</code>
                        <p className={cn('text-sm', item.className)}>Node J17 measured 4.98 V</p>
                      </div>
                    ))}
                    <div className="flex flex-col gap-1">
                      <code className="font-mono text-xs text-text-tertiary">text-inverse</code>
                      <span className="self-start rounded-pill bg-text-primary px-3 py-1 text-sm text-text-inverse">
                        On inverted ground
                      </span>
                    </div>
                  </div>
                </Panel>
              </div>
            </Section>

            <Section
              id="states"
              eyebrow="Foundations"
              title="Semantic states"
              description="Five tones, each a base plus a surface / line / ink trio. ok is the brand accent — in a diagnostic trainer 'correct' is what the whole product moves toward — which loads more weight onto the other four, so they are separated on hue, lightness and a mandatory icon shape at once. Set the header picker to a dichromacy simulation: the hues collapse, the silhouettes and the words do not."
            >
              <div className="flex flex-col gap-6">
                {/* Both themes at once, read straight off tokens.css rather than
                    restated here — the light accent is a different hue, and a
                    palette shown in only one theme hides that. */}
                <ThemeSplit>
                  <div className="flex flex-col gap-4">
                    {TONES.map((item) => (
                      <div key={item.tone} className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex shrink-0 overflow-hidden rounded-xs border border-line-strong"
                        >
                          {item.ramp.map((swatch) => (
                            <span key={swatch} className={cn('size-5', swatch)} />
                          ))}
                        </span>
                        <code className="w-14 shrink-0 font-mono text-xs text-text-tertiary">
                          {item.tone}
                        </code>
                        <StatusBadge tone={item.tone}>{item.short}</StatusBadge>
                      </div>
                    ))}
                  </div>
                </ThemeSplit>

                <p className="text-micro uppercase text-text-tertiary">
                  Ramp order · base · surface · line · ink
                </p>

                <Panel label="StatusBadge in context" note="state is never colour alone">
                  <div className="flex flex-wrap gap-3">
                    {TONES.map((item) => (
                      <StatusBadge key={item.tone} tone={item.tone}>
                        {item.example}
                      </StatusBadge>
                    ))}
                  </div>
                </Panel>
              </div>
            </Section>

            <Section
              id="type"
              eyebrow="Foundations"
              title="Typography"
              description="Clash Display for display sizes and nothing under 20px, Satoshi for all interface text, JetBrains Mono for anything measured. The gap between lg (17px) and display-xs (22px) is deliberate: there is no size in between, and that missing middle is what makes a layout read as composed rather than stacked."
            >
              <div className="flex flex-col gap-4">
                <Panel label="Display · Clash Display" note="font-display, 20px and up">
                  <div className="flex flex-col gap-5">
                    {DISPLAY_SCALE.map((step) => (
                      <div key={step.name} className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                        <code className="w-28 shrink-0 font-mono text-xs text-text-tertiary">
                          {step.name}
                        </code>
                        <span className="w-10 shrink-0 font-mono text-xs text-text-tertiary/60">
                          {step.size}
                        </span>
                        <span className={cn('min-w-0 truncate font-display', step.className)}>
                          {step.sample}
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel label="Interface · Satoshi" note="font-sans">
                    <div className="flex flex-col gap-4">
                      {UI_SCALE.map((step) => (
                        <div key={step.name} className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                          <code className="w-16 shrink-0 font-mono text-xs text-text-tertiary">
                            {step.name}
                          </code>
                          <span className="w-10 shrink-0 font-mono text-xs text-text-tertiary/60">
                            {step.size}
                          </span>
                          <span className={step.className}>Node J17 measured 4.98 V</span>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <Panel label="Measured · JetBrains Mono" note="font-mono">
                    <div className="flex flex-col gap-4">
                      <p className="font-mono text-sm text-text-primary">
                        R3 · 220 Ω · net_7 · 4.98 V · 22.6 mA
                      </p>
                      <Rule />
                      <p className="max-w-prose text-sm text-text-secondary">
                        Mono is for values a student could read off an instrument, for node and net
                        identifiers, and for the terminal motifs. It is never used for prose.
                      </p>
                    </div>
                  </Panel>
                </div>
              </div>
            </Section>

            <Section
              id="shape"
              eyebrow="Foundations"
              title="Shape & elevation"
              description="Pills for anything you can interact with, a small radius for anything that behaves like a surface, and nothing in between — reaching for a middle radius is the single move that makes a UI look defaulted. Elevation follows the same rule: a hairline separates, and a shadow is reserved for things that genuinely float."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel label="Radii" note="there is no middle radius">
                  <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                    {RADII.map((radius) => (
                      <div key={radius.name} className="flex flex-col items-start gap-3">
                        <div
                          className={cn('h-14 w-full border border-line-strong bg-bg-700', radius.className)}
                        />
                        <code className="font-mono text-xs text-text-secondary">{radius.name}</code>
                        <span className="text-micro uppercase text-text-tertiary">{radius.note}</span>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel label="Elevation" note="hairline first, shadow last">
                  <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                    {ELEVATION.map((step) => (
                      <div key={step.name} className="flex flex-col items-start gap-3">
                        <div className={cn('h-14 w-full rounded-card bg-bg-700', step.className)} />
                        <code className="font-mono text-xs text-text-secondary">{step.name}</code>
                        <span className="text-micro uppercase text-text-tertiary">{step.note}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </Section>

            <Section
              id="motion"
              eyebrow="Foundations"
              title="Motion"
              description="Content rises in, hairlines draw themselves, placeholders shimmer. Easing is always ease-out — fast away, slow to settle — and nothing bounces or spins except the spinner. All of it collapses to nothing under the reduce-motion preference, which is handled globally in index.css, so no component adds an inline transition that could bypass it."
              action={
                <Button variant="secondary" size="sm" onClick={() => setMotionKey((n) => n + 1)}>
                  <RotateCcw aria-hidden="true" />
                  Replay
                </Button>
              }
            >
              <div key={motionKey} className="grid gap-4 lg:grid-cols-2">
                <Panel label="rise-in" note="stagger-1 … stagger-3">
                  <div className="flex flex-col gap-3">
                    {['Load the exercise', 'Seat the components', 'Probe the rail'].map((line, index) => (
                      <div
                        key={line}
                        className={cn(
                          'flex animate-rise-in items-center gap-3 rounded-pill border border-line bg-bg-700 px-4 py-2 text-sm text-text-secondary',
                          ['stagger-1', 'stagger-2', 'stagger-3'][index],
                        )}
                      >
                        <span className="font-mono text-xs text-accent">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        {line}
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel label="rule-draw · shimmer · fade-in · spin">
                  <div className="flex flex-col gap-5">
                    <Rule />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                    <div className="flex items-center gap-4">
                      <Spinner size="sm" />
                      <Badge tone="info" className="animate-fade-in">
                        fade-in
                      </Badge>
                      <span className="text-xs text-text-tertiary">
                        caret-blink lives on the terminal line below
                      </span>
                    </div>
                  </div>
                </Panel>
              </div>
            </Section>

            {/* ---------------------------------------------------------- */}
            {/* Signature vocabulary                                       */}
            {/* ---------------------------------------------------------- */}

            <Section
              id="signature"
              eyebrow="Signature"
              title="The vocabulary"
              description="Five components carry the character of the design. Use them rather than rebuilding the effect inline — an eyebrow hand-rolled at 12px with the wrong tracking is how a system starts to drift."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel label="Eyebrow">
                  <div className="flex flex-col gap-4">
                    <Eyebrow>Without marker</Eyebrow>
                    <Eyebrow marker>With marker</Eyebrow>
                  </div>
                </Panel>

                <Panel label="Rule">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <span className="text-micro uppercase text-text-tertiary">default</span>
                      <Rule />
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-micro uppercase text-text-tertiary">accent</span>
                      <Rule tone="accent" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-micro uppercase text-text-tertiary">draw</span>
                      <Rule />
                    </div>
                  </div>
                </Panel>

                <Panel label="StatBlock">
                  <div className="flex flex-wrap gap-10">
                    <StatBlock value="12" label="Exercises" />
                    <StatBlock value="4.98 V" label="Midpoint" tone="accent" />
                    <StatBlock value="83%" label="Pass rate" detail="of 12 attempts" />
                  </div>
                </Panel>

                <Panel label="SectionHeading" note="eyebrow → title → rule → prose" className="lg:col-span-2">
                  <SectionHeading
                    eyebrow="Exercise 3"
                    title="Voltage divider"
                    description="Build a 2:1 divider from two 220 Ω resistors and measure the midpoint against the 5 V rail."
                    action={
                      <Button size="sm" variant="secondary">
                        Schematic
                      </Button>
                    }
                  />
                </Panel>
              </div>
            </Section>

            <Section
              id="board"
              eyebrow="Signature"
              title="The board"
              description="The one drawing in the product, and the only thing in it that moves. It is a component with props rather than a picture: the same file draws the still board beside the sign-in form and the one that builds itself on the landing page."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel label="Whole circuit" note="litNets={all}">
                  <Breadboard litNets={NETS.map((net) => net.id)} />
                  <p className="mt-3 text-sm text-text-secondary">
                    All three nets bonded, so the LED lights. This is the state the auth aside shows.
                  </p>
                </Panel>

                <Panel label="One net focused" note='focusedNet="n2"'>
                  <Breadboard litNets={NETS.map((net) => net.id)} focusedNet="n2" />
                  <p className="mt-3 text-sm text-text-secondary">
                    Focusing fills the whole column, not the single hole a leg sits in — the point being that
                    five holes are one node.
                  </p>
                </Panel>

                <Panel label="Mid-scan" note="scan={0.45} placed={3}">
                  <Breadboard scan={0.45} />
                </Panel>

                <Panel label="Fault named" note='fault faultedNet="n3"'>
                  <Breadboard litNets={NETS.map((net) => net.id)} fault faultedNet="n3" />
                  <p className="mt-3 text-sm text-text-secondary">
                    The ground jumper is one bank out. It looks aligned, the LED stays dark, and the broken
                    net is drawn in the fault colour rather than the accent.
                  </p>
                </Panel>
              </div>

              <Panel
                label="In three dimensions"
                note="BoardStage dimensional — lazy chunk, SVG until it lands"
                className="mt-4"
              >
                <div className="mx-auto max-w-xl">
                  <BoardStage dimensional litNets={NETS.map((net) => net.id)} fault faultedNet="n3" />
                </div>
                <p className="mt-3 text-sm text-text-secondary">
                  The same circuit and the same tokens as the drawing above, in WebGL. It is code-split: the
                  entry bundle does not contain three.js, and this only fetches once the board has been
                  scrolled into view.
                </p>
              </Panel>

              <Panel
                label="The whole demonstration"
                note="BoardShowcase — loops, and stops under .reduce-motion"
                className="mt-4"
              >
                <div className="mx-auto max-w-lg">
                  <BoardShowcase />
                </div>
              </Panel>
            </Section>

            {/* ---------------------------------------------------------- */}
            {/* Controls                                                   */}
            {/* ---------------------------------------------------------- */}

            <Section
              id="button"
              eyebrow="Controls"
              title="Button"
              description="Five variants and four sizes. Exactly one action on any screen is primary; everything else is secondary, ghost or link, and danger is reserved for something that destroys data. The hover and focus columns force the classes those pseudo-states apply, since a static page cannot show them otherwise."
            >
              <div className="flex flex-col gap-4">
                {BUTTON_VARIANTS.map(({ variant, hover }) => (
                  <Panel key={variant} label={variant} note={hover}>
                    <SpecimenGrid columns={5}>
                      <Specimen label="default">
                        <Button variant={variant}>Run check</Button>
                      </Specimen>
                      <Specimen label="hover">
                        <Button variant={variant} className={hover}>
                          Run check
                        </Button>
                      </Specimen>
                      <Specimen label="focus">
                        <Button variant={variant} className={FOCUS_RING}>
                          Run check
                        </Button>
                      </Specimen>
                      <Specimen label="disabled">
                        <Button variant={variant} disabled>
                          Run check
                        </Button>
                      </Specimen>
                      <Specimen label="loading">
                        <Button variant={variant} loading>
                          Checking
                        </Button>
                      </Specimen>
                    </SpecimenGrid>
                  </Panel>
                ))}

                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel label="Sizes" note="sm · md · lg · icon">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button size="sm">Small</Button>
                      <Button size="md">Medium</Button>
                      <Button size="lg">Large</Button>
                      <Button size="icon" variant="secondary" aria-label="Delete exercise">
                        <Trash2 />
                      </Button>
                      <Button variant="secondary">
                        <FolderOpen />
                        With icon
                      </Button>
                    </div>
                  </Panel>

                  <Panel label="TextButton" note="hover steps the brackets 2px outward">
                    <SpecimenGrid columns={3}>
                      <Specimen label="default">
                        <TextButton>Know me better</TextButton>
                      </Specimen>
                      <Specimen label="hover">
                        <TextButton className="[&>span:first-of-type]:-translate-x-0.5 [&>span:last-of-type]:translate-x-0.5">
                          Know me better
                        </TextButton>
                      </Specimen>
                      <Specimen label="disabled">
                        <TextButton disabled>Know me better</TextButton>
                      </Specimen>
                    </SpecimenGrid>
                  </Panel>
                </div>
              </div>
            </Section>

            <Section
              id="chip"
              eyebrow="Controls"
              title="Chip"
              description="The filter pill. Selection is a fill rather than a tint, so the difference between on and off is weight and contrast and survives with the colour taken away. Each chip is an independent toggle and carries aria-pressed, not a link."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel label="States">
                  <SpecimenGrid columns={2}>
                    <Specimen label="default">
                      <Chip>Analog</Chip>
                    </Specimen>
                    <Specimen label="active">
                      <Chip active>Analog</Chip>
                    </Specimen>
                    <Specimen label="with count">
                      <Chip count={24}>Faults</Chip>
                    </Specimen>
                    <Specimen label="active + count">
                      <Chip active count={24}>
                        Faults
                      </Chip>
                    </Specimen>
                    <Specimen label="disabled">
                      <Chip disabled>Analog</Chip>
                    </Specimen>
                    <Specimen label="sizes">
                      <Chip size="sm">sm</Chip>
                      <Chip size="md">md</Chip>
                    </Specimen>
                  </SpecimenGrid>
                </Panel>

                <Panel label="A live facet row" note="independent toggles, not a radio group">
                  <div className="flex flex-wrap gap-2">
                    {FACETS.map((facet) => (
                      <Chip
                        key={facet.id}
                        count={facet.count}
                        active={facets.includes(facet.id)}
                        onClick={() => toggleFacet(facet.id)}
                      >
                        {facet.label}
                      </Chip>
                    ))}
                  </div>
                  <p className="mt-4 font-mono text-xs text-text-tertiary">
                    pressed · {facets.length ? facets.join(', ') : 'none'}
                  </p>
                </Panel>
              </div>
            </Section>

            <Section
              id="input"
              eyebrow="Controls"
              title="Input"
              description="A pill on the raised ground, separated by a hairline. The label is an eyebrow — 11px, wide-tracked, caps — and the message slot underneath holds either a hint or an error, never both, so validation never reflows the form. An error always draws the fault octagon beside it; the red border alone would not survive a dichromacy simulation."
            >
              <Panel label="States" note="focus is a forced class">
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  <Input label="Default" placeholder="Ada Reyes" />
                  <Input label="With hint" placeholder="2021-00123" hint="Format: YYYY-NNNNN" />
                  <Input label="Optional" optional placeholder="Section, if you know it" />
                  <Input
                    label="Error"
                    defaultValue="ada.reyes@"
                    error="That is not a complete email address."
                  />
                  <Input label="Disabled" defaultValue="BSCPE 3-A" disabled />
                  <Input label="Focus" placeholder="Tab into me" className={FOCUS_RING} />
                  <Input
                    label="Leading icon"
                    placeholder="Search exercises"
                    leadingIcon={<Search aria-hidden="true" />}
                  />
                  <Input
                    label="Trailing slot"
                    type="password"
                    defaultValue="hunter2"
                    trailingSlot={
                      <Button variant="ghost" size="icon" className="size-7" aria-label="Reveal password">
                        <EyeOff />
                      </Button>
                    }
                  />
                  <Input
                    label="Read-only"
                    defaultValue="net_7"
                    readOnly
                    hint="Assigned by the netlist importer."
                  />
                </div>
              </Panel>
            </Section>

            <Section
              id="textarea"
              eyebrow="Controls"
              title="Textarea"
              description="The same surface as Input, but rounded-card — a pill on a box this tall reads as a stretched button. Vertical resizing stays on, because the student knows how much they are writing better than the layout does."
            >
              <Panel label="States">
                <div className="grid gap-6 lg:grid-cols-3">
                  <Textarea
                    label="Default"
                    placeholder="Describe what you measured…"
                    hint="Two or three sentences is plenty."
                  />
                  <Textarea
                    label="Error"
                    defaultValue="it broke"
                    error="Say which node you probed and what you read."
                  />
                  <Textarea label="Disabled" defaultValue="Submitted 12 March, 14:02." disabled />
                </div>
              </Panel>
            </Section>

            <Section
              id="select"
              eyebrow="Controls"
              title="Select"
              description="A select is a text field you cannot type into, so it takes the same pill. It is compound and cannot label itself — wrapping it in a Field is the normal path, and the trigger then picks up that Field's id, description and error state from context. The bare error prop is the escape hatch for a trigger standing on its own."
            >
              <Panel label="States" note="Field owns the label; the trigger reads it from context">
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                  <Field label="Default" hint="Sets the fault budget.">
                    <Select defaultValue="2">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((level) => (
                          <SelectItem key={level} value={String(level)}>
                            Difficulty {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Placeholder + error" error="Pick a role before continuing.">
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="instructor">Instructor</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Disabled">
                    <Select disabled defaultValue="student">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Grouped" hint="SelectLabel names each group.">
                    <Select defaultValue="r-220">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Passive</SelectLabel>
                          <SelectItem value="r-220">Resistor · 220 Ω</SelectItem>
                          <SelectItem value="c-100n">Capacitor · 100 nF</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Active</SelectLabel>
                          <SelectItem value="led-red">LED · red</SelectItem>
                          <SelectItem value="npn" disabled>
                            Transistor · out of stock
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="mt-6 border-t border-line pt-6">
                  <Specimen label="bare trigger · error prop" stack className="max-w-64">
                    <Select>
                      <SelectTrigger error aria-label="Role">
                        <SelectValue placeholder="Choose a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="instructor">Instructor</SelectItem>
                      </SelectContent>
                    </Select>
                  </Specimen>
                </div>
              </Panel>
            </Section>

            <Section
              id="checkbox"
              eyebrow="Controls"
              title="Checkbox"
              description="The one place the tiny radius is right: a 20px box with pill ends is a lozenge. The label sits beside the control and stays in sentence case, because a checkbox label is a claim the user is agreeing to and wide-tracked caps make a sentence unreadable."
            >
              <Panel label="States">
                <SpecimenGrid columns={3}>
                  <Specimen label="unchecked" stack>
                    <Checkbox label="Email me when a build fails" />
                  </Specimen>
                  <Specimen label="checked" stack>
                    <Checkbox defaultChecked label="Email me when a build fails" />
                  </Specimen>
                  <Specimen label="indeterminate" stack>
                    <Checkbox defaultChecked="indeterminate" label="Select all exercises" />
                  </Specimen>
                  <Specimen label="disabled" stack>
                    <Checkbox disabled label="Email me when a build fails" />
                  </Specimen>
                  <Specimen label="disabled + checked" stack>
                    <Checkbox disabled defaultChecked label="Managed by your instructor" />
                  </Specimen>
                  <Specimen label="with hint" stack>
                    <Checkbox label="Share anonymised attempts" hint="Used to tune the difficulty curve." />
                  </Specimen>
                  <Specimen label="with error" stack>
                    <Checkbox
                      label="I have read the lab safety notes"
                      error="You have to confirm this before starting."
                    />
                  </Specimen>
                </SpecimenGrid>
              </Panel>
            </Section>

            <Section
              id="switch"
              eyebrow="Controls"
              title="Switch"
              description="For a setting that takes effect immediately, where a checkbox implies a form to submit. The knob's position carries the state as much as the fill does, which is what keeps it readable with the colour taken away — but it still needs a text label beside it naming what it controls."
            >
              <Panel label="Accessibility preferences" className="max-w-md">
                <div className="flex flex-col gap-4">
                  <SwitchRow label="High contrast" />
                  <SwitchRow label="Reduce motion" defaultChecked />
                  <SwitchRow label="Larger text" disabled />
                  <SwitchRow label="Locked on by policy" defaultChecked disabled />
                </div>
              </Panel>
            </Section>

            <Section
              id="password"
              eyebrow="Controls"
              title="Password input"
              description='The Input pill with a reveal control docked in its right edge. A student on a phone keyboard mistyping a password they cannot see is the most common reason a first sign-in fails, and that failure is indistinguishable from a wrong account — so the toggle is not a nicety. It is type="button", or revealing the password would submit the half-filled form.'
            >
              <SpecimenGrid columns={2}>
                <Specimen label="Default" stack>
                  <PasswordInput label="Password" defaultValue="correct-horse-battery" />
                </Specimen>
                <Specimen label="With a hint" stack>
                  <PasswordInput
                    label="New password"
                    hint="At least 8 characters. Length beats punctuation."
                    defaultValue=""
                  />
                </Specimen>
                <Specimen label="Error" stack>
                  <PasswordInput
                    label="Current password"
                    error="That is not your current password."
                    defaultValue="wrong"
                  />
                </Specimen>
                <Specimen label="Disabled" stack>
                  <PasswordInput label="Password" disabled defaultValue="unavailable" />
                </Specimen>
              </SpecimenGrid>
            </Section>

            <Section
              id="segmented"
              eyebrow="Controls"
              title="Segmented control"
              description="One pill split into segments, for a choice between two or three options the person makes once and then recognises. A radiogroup rather than a row of toggles — exactly one is selected, arrows move between them, and the group is a single tab stop. The chosen segment takes the accent fill, so it differs in weight as well as hue."
            >
              <SpecimenGrid columns={2}>
                <Specimen label="Two options" stack>
                  <SegmentedSpecimen
                    options={[
                      { value: 'student', label: 'Student' },
                      { value: 'instructor', label: 'Instructor' },
                    ]}
                  />
                </Specimen>
                <Specimen label="Three, with hints" stack>
                  <SegmentedSpecimen
                    options={[
                      { value: 'dark', label: 'Dark' },
                      { value: 'light', label: 'Light' },
                      { value: 'system', label: 'System', hint: 'follows OS' },
                    ]}
                  />
                </Specimen>
                <Specimen label="Full width" stack>
                  <SegmentedSpecimen
                    fill
                    options={[
                      { value: 'en', label: 'English' },
                      { value: 'fil', label: 'Filipino' },
                    ]}
                  />
                </Specimen>
                <Specimen label="With one disabled" stack>
                  <SegmentedSpecimen
                    options={[
                      { value: 'student', label: 'Student' },
                      { value: 'instructor', label: 'Instructor' },
                      { value: 'admin', label: 'Admin', disabled: true },
                    ]}
                  />
                </Specimen>
              </SpecimenGrid>
            </Section>

            {/* ---------------------------------------------------------- */}
            {/* Feedback                                                   */}
            {/* ---------------------------------------------------------- */}

            <Section
              id="badge"
              eyebrow="Feedback"
              title="Badge"
              description="Plain Badge is for categories. StatusBadge is the only thing allowed to express one of the five semantic states, and it hard-wires a distinct silhouette per tone — circle, triangle, octagon — so the state survives greyscale, dichromacy and a bad projector."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel label="Badge" note="a category, no icon">
                  <div className="flex flex-wrap gap-2">
                    {TONES.map((item) => (
                      <Badge key={item.tone} tone={item.tone}>
                        {item.tone}
                      </Badge>
                    ))}
                  </div>
                </Panel>
                <Panel label="StatusBadge" note="a state, icon mandatory">
                  <div className="flex flex-wrap gap-2">
                    {TONES.map((item) => (
                      <StatusBadge key={item.tone} tone={item.tone}>
                        {item.tone}
                      </StatusBadge>
                    ))}
                  </div>
                </Panel>
              </div>
            </Section>

            <Section
              id="callout"
              eyebrow="Feedback"
              title="Callout"
              description='The block-level counterpart to StatusBadge: a whole message rather than a label, for the things a form has to say that do not attach to one field. A toast would vanish before the sentence is finished reading. Fault and warn take role="alert" so they are announced the moment they appear; the rest are polite.'
            >
              <div className="flex max-w-2xl flex-col gap-4">
                <Callout tone="ok" title="Your password is changed.">
                  Every other signed-in browser has been signed out.
                </Callout>
                <Callout tone="info" title="Check your email">
                  We sent a confirmation link to andrea@students.example.edu. It works once and expires in a
                  day.
                </Callout>
                <Callout
                  tone="warn"
                  title="That link has expired"
                  action={<TextButton>Send me a new one</TextButton>}
                >
                  Reset links last an hour.
                </Callout>
                <Callout tone="fault" title="That email and password do not match an account." />
                <Callout tone="neutral">A message with no title, for one plain sentence.</Callout>
              </div>
            </Section>

            <Section
              id="progress"
              eyebrow="Feedback"
              title="Progress"
              description="A 2px hairline that happens to fill. Progress here is ambient — how far into an exercise, how much of onboarding is done — so it sits at the weight of a rule and lets the label and the readout carry the actual reading. An absent value is the not-yet-known state and reads as empty rather than crawling. The ring is the one exception, and there is one per screen: a completion figure about the person reading it rather than about the work."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel label="States">
                  <div className="flex flex-col gap-8">
                    <Progress label="Not started" readout="0 / 7" value={0} max={7} />
                    <Progress label="In progress" readout="3 / 7" value={3} max={7} />
                    <Progress label="Complete" readout="7 / 7" value={7} max={7} />
                    <Progress label="Awaiting the board" readout="—" value={null} />
                  </div>
                </Panel>

                {/* The tinted tones exist for a bar sitting inside a tinted
                    surface — a dashboard class card — where the accent would be
                    the one colour on the card belonging to nothing. `bar` is the
                    only case where the bar itself is the reading. */}
                <Panel label="Tones, at bar weight">
                  <div className="flex flex-col gap-8">
                    <Progress tone="info" weight="bar" label="Analog I" readout="4 / 7" value={4} max={7} />
                    <Progress tone="ok" weight="bar" label="Digital I" readout="6 / 7" value={6} max={7} />
                    <Progress tone="warn" weight="bar" label="Power lab" readout="2 / 7" value={2} max={7} />
                  </div>
                </Panel>

                {/* One per screen, and the dashboard has spent it. */}
                <Panel label="Ring" className="lg:col-span-2">
                  <div className="flex flex-wrap items-center gap-10">
                    {[0, 33, 67, 100].map((percent) => (
                      <div key={percent} className="flex flex-col items-center gap-2">
                        <ProgressRing value={percent} size={80}>
                          <span className="font-display text-sm font-semibold tabular-nums text-text-primary">
                            {percent}%
                          </span>
                        </ProgressRing>
                        <span className="text-xs text-text-tertiary">{percent} of 100</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </Section>

            <Section
              id="difficulty"
              eyebrow="Feedback"
              title="Difficulty meter"
              description='Five bars filled to the level, for an exercise list. It replaced a badge reading "Difficulty 3 of 5" — correct, but eight sentences to compare down a list where this is one shape. The sentence survives as the accessible name, so nothing is lost by not being able to see the bars, and the fill count rather than the colour is what carries the reading.'
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Panel label="Levels">
                  <div className="flex flex-col gap-4">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div key={level} className="flex items-center gap-3">
                        <DifficultyMeter level={level} label={`Difficulty ${level} of 5`} />
                        <span className="text-sm text-text-secondary">Difficulty {level} of 5</span>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel label="In a pill" note="as the dashboard uses it">
                  <div className="flex flex-col items-start gap-4">
                    <Badge tone="neutral" className="gap-2">
                      <DifficultyMeter size="sm" level={3} label="Difficulty 3 of 5" />
                      <span aria-hidden="true">Difficulty 3 of 5</span>
                    </Badge>
                    <DifficultyMeter size="sm" level={4} label="Difficulty 4 of 5" />
                  </div>
                </Panel>
              </div>
            </Section>

            <Section
              id="stepper"
              eyebrow="Feedback"
              title="Stepper"
              description="Progress through a short wizard — built for the three-step onboarding and nothing longer. State is carried three ways: the index becomes a check once a step is done, the rule under the current step is accent where the others are hairline, and aria-current says so out loud. It is an ordered list, so a screen reader announces 2 of 3 without being told."
            >
              <div className="flex max-w-2xl flex-col gap-10">
                {[0, 1, 2].map((step) => (
                  <Panel key={step} label={`current = ${step}`}>
                    <Stepper
                      steps={[
                        { id: 'identity', label: 'Who you are' },
                        { id: 'class', label: 'Your class' },
                        { id: 'how', label: 'How this works' },
                      ]}
                      current={step}
                      progressLabel={`Step ${step + 1} of 3`}
                    />
                  </Panel>
                ))}
              </div>
            </Section>

            <Section
              id="toast"
              eyebrow="Feedback"
              title="Toast"
              description="Fired from anywhere, including outside React. Each tone gets its own silhouette and a spoken prefix, so it reads with both the colour and the shape stripped. Prefer an inline field error for anything the user can fix in place — a toast is for what they must notice."
            >
              <Panel label="Fire one" note="toast.ok · warn · fault · info">
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => toast.ok('Board saved', 'Your progress is stored.')}
                  >
                    ok
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => toast.warn('Loose connection', 'Row 14 is only partly seated.')}
                  >
                    warn
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => toast.fault('Short circuit', 'The 5 V rail is tied to ground.')}
                  >
                    fault
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => toast.info('Hint unlocked', 'Check the direction of D1.')}
                  >
                    info
                  </Button>
                </div>
              </Panel>
            </Section>

            <Section
              id="tooltip"
              eyebrow="Feedback"
              title="Tooltip"
              description="Small, sharp and shadowed: it floats over live content, so the hairline alone is not enough separation. It opens on hover and on focus, which is what makes an icon-only button legal — a tooltip is never the only place a control's name exists, so the aria-label is still there."
            >
              <Panel label="Triggers">
                <div className="flex flex-wrap items-center gap-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="secondary">Hover or focus me</Button>
                    </TooltipTrigger>
                    <TooltipContent>Opens the schematic overlay (S)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Delete exercise">
                        <Trash2 />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete exercise</TooltipContent>
                  </Tooltip>
                </div>
              </Panel>
            </Section>

            <Section
              id="spinner"
              eyebrow="Feedback"
              title="Spinner"
              description="The one thing in the system allowed to spin. It announces itself as a status by default; pass label={null} where a visible label already says what is loading, so a screen reader does not hear it twice."
            >
              <Panel label="Sizes" note="sm · md · lg">
                <div className="flex flex-wrap items-center gap-8">
                  <Spinner size="sm" />
                  <Spinner size="md" />
                  <Spinner size="lg" />
                  <span className="flex items-center gap-3 text-sm text-text-secondary">
                    <Spinner size="sm" label={null} />
                    Checking the board…
                  </span>
                </div>
              </Panel>
            </Section>

            <Section
              id="skeleton"
              eyebrow="Feedback"
              title="Skeleton"
              description="Give it the exact dimensions of the content it stands in for. Matching heights is the entire point: nothing should move when the data arrives. Two shapes, because there are only two kinds of thing a placeholder stands in for — a run of text, or a surface."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel label="line" note="text-height placeholders">
                  <div className="flex flex-col gap-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="flex gap-3 pt-2">
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </div>
                </Panel>
                <Panel label="block" note="cards, media and panels">
                  <Skeleton shape="block" className="h-36 w-full" />
                </Panel>
              </div>
            </Section>

            {/* ---------------------------------------------------------- */}
            {/* Surfaces                                                   */}
            {/* ---------------------------------------------------------- */}

            <Section
              id="card"
              eyebrow="Surfaces"
              title="Card"
              description="Raised ground, one hairline, no shadow — a card sits on the page rather than floating above it. The interactive variant is only for a card that is genuinely a link or opens something; a card that is a readout should stay inert, or the affordance stops meaning anything."
            >
              {/* Two columns with the right one dropped: an offset pair reads as
                  composed where four equal cards read as a template. */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="flex flex-col gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Voltage divider</CardTitle>
                      <CardDescription>
                        Build a 2:1 divider and measure the midpoint against the 5 V rail.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <StatusBadge tone="ok">Completed</StatusBadge>
                    </CardContent>
                    <CardFooter>
                      <Button size="sm">Review</Button>
                      <Button size="sm" variant="ghost">
                        Retry
                      </Button>
                    </CardFooter>
                  </Card>

                  <Card className="border-fault-line">
                    <CardHeader>
                      <CardTitle>Failure state</CardTitle>
                      <CardDescription>
                        A card in trouble keeps a badge, not just a coloured border — the border is a
                        glance-level hint and nothing more.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <StatusBadge tone="fault">Could not load</StatusBadge>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-col gap-6 lg:mt-12">
                  <Card interactive>
                    <CardHeader>
                      <CardTitle>Interactive</CardTitle>
                      <CardDescription>
                        Hover or tab into the link below: the hairline firms up, the ground steps once and the
                        whole card lifts 2px.
                      </CardDescription>
                    </CardHeader>
                    <CardFooter>
                      <Button variant="link" size="sm">
                        Open exercise
                        <ArrowUpRight />
                      </Button>
                    </CardFooter>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Loading</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="mt-2 h-6 w-28" />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </Section>

            <Section
              id="dialog"
              eyebrow="Surfaces"
              title="Dialog"
              description="The one piece of chrome that earns display type, and one of the few things allowed a shadow. The scrim is the page ground at high alpha rather than inverted ink, so it stays near-black on dark instead of flashing white."
            >
              <Panel label="Trigger">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary">Open dialog</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Submit this attempt?</DialogTitle>
                      <DialogDescription>
                        Your board will be checked against the exercise, and you will not be able to change it
                        afterwards.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogBody>
                      <p className="font-mono text-xs text-text-tertiary">
                        elapsed 12:41 · 2 faults · 1 hint used
                      </p>
                    </DialogBody>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="secondary">Keep building</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button>Submit</Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </Panel>
            </Section>

            <Section
              id="menu"
              eyebrow="Surfaces"
              title="Dropdown menu"
              description="Surface ground, not raised — the raised step is spent on the highlighted row, which is the only thing in here that needs to come forward. Rows take the tiny radius: a full-width row with pill ends reads as a button that got stretched."
            >
              <Panel label="Trigger">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary">Board actions</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Exercise 3 · voltage divider</DropdownMenuLabel>
                    <DropdownMenuItem>
                      <Copy aria-hidden="true" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Download aria-hidden="true" />
                      Export netlist
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>
                      <Trash2 aria-hidden="true" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Panel>
            </Section>

            <Section
              id="empty"
              eyebrow="Surfaces"
              title="Empty state"
              description="Every list in the app renders one of these instead of nothing: a blank region reads as a bug, a designed empty state reads as 'there is genuinely nothing here'. It is a panel rather than a dashed outline, because a dashed border says content is missing and here nothing is."
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <EmptyState
                  eyebrow="Classes"
                  title="No classes yet"
                  description="Ask your instructor for a six-character join code to get started."
                  action={
                    <Button size="sm">
                      <Plus />
                      Join a class
                    </Button>
                  }
                />
                <EmptyState
                  icon={BookOpen}
                  title="No exercises assigned"
                  description="Once your instructor publishes an exercise it will show up here."
                />
              </div>
            </Section>

            <Section
              id="layout"
              eyebrow="Surfaces"
              title="Page header"
              description="Breadcrumb, title, one line of prose, actions — left-aligned, with a hairline underneath so a screen that scrolls has a boundary between what the page is and what is on it. The AppShell around this page is the real one; the header below is a specimen with every slot filled."
            >
              <div className="overflow-hidden rounded-card border border-line bg-bg-800">
                {/* A second <h1> on the page, which a style guide can live with:
                    the alternative is documenting the component without showing
                    it. Do not copy this pattern into a product screen. */}
                <PageHeader
                  className="px-6 py-6 sm:px-6"
                  title="Voltage divider"
                  subtitle="Difficulty 2 · roughly 20 minutes · two faults injected."
                  breadcrumb={[
                    { label: 'Dashboard', to: '/' },
                    { label: 'CPE 3-A', to: '/' },
                    { label: 'Voltage divider' },
                  ]}
                  action={
                    <>
                      <Button variant="secondary" size="sm">
                        Schematic
                      </Button>
                      <Button size="sm">Start</Button>
                    </>
                  }
                />
              </div>
            </Section>

            <footer className="flex flex-col gap-5 pt-8">
              <Rule />
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="text-micro uppercase text-text-tertiary">
                  End of the system · {SECTION_IDS.length} sections
                </span>
                <TextButton asChild>
                  <a href="#top">Back to top</a>
                </TextButton>
              </div>
            </footer>
          </div>
        </div>
      </AppShell>
    </TooltipProvider>
  )
}

/**
 * A switch is meaningless without a label naming what it controls, and the
 * label has to be a real `<label htmlFor>` rather than adjacent text — Radix
 * renders a button, which takes no implicit labelling from a wrapper.
 */
/**
 * A SegmentedControl is fully controlled, so a specimen needs somewhere to keep
 * the selection. This is that, and nothing else — the point of the page is that
 * every control on it actually works.
 */
function SegmentedSpecimen({
  options,
  fill,
}: {
  options: readonly SegmentedOption<string>[]
  fill?: boolean
}) {
  const [value, setValue] = React.useState(options[0]?.value ?? '')
  return (
    <SegmentedControl
      options={options}
      value={value}
      onValueChange={setValue}
      label="Specimen"
      {...(fill && { fill })}
    />
  )
}

function SwitchRow({
  label,
  defaultChecked,
  disabled,
}: {
  label: string
  defaultChecked?: boolean
  disabled?: boolean
}) {
  const id = React.useId()
  return (
    <div className="flex items-center justify-between gap-4">
      <label
        htmlFor={id}
        className={cn('text-sm text-text-secondary', disabled && 'cursor-not-allowed opacity-50')}
      >
        {label}
      </label>
      <Switch id={id} defaultChecked={defaultChecked} disabled={disabled} />
    </div>
  )
}
