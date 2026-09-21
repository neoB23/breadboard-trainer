# Design system

Read this before building a screen. It exists so that the remaining phases add pages without
adding decisions. [`design-brief.md`](design-brief.md) is the *why*; this is the *how*.

## Where things live

| Thing                        | File                          |
| ---------------------------- | ----------------------------- |
| Colour, radius, elevation    | `src/styles/tokens.css`       |
| Token → Tailwind mapping     | `tailwind.config.ts`          |
| Global base styles, a11y CSS | `src/index.css`               |
| Primitives                   | `src/components/ui/`          |
| Shell and page chrome        | `src/components/layout/`      |
| Message catalogues           | `src/i18n/en.ts`, `fil.ts`    |
| Live catalogue               | `/styleguide`                 |

## Colour

Tailwind's stock palette is **replaced**, not extended. `bg-red-500` does not compile. The
theme contains only:

**Grounds** — `bg-900` (page), `bg-800` (surface), `bg-700` (raised · hover), `bg-600` (edge)
**Rules** — `border-line`, `border-line-strong`
**Ink** — `text-primary`, `text-secondary`, `text-tertiary`, `text-inverse`
**Accent** — `accent`, `accent-ink` (hover), `accent-contrast` (ink on the accent)
**States** — `ok`, `warn`, `fault`, `info`, `neutral`, each with `-surface`, `-line`, `-ink`

Every one is an HSL triplet behind a CSS variable, so `bg-accent/10` works and the dark theme
is a variable swap rather than a second set of classes.

```tsx
<div className="border-line bg-bg-800 text-text-secondary" />
<div className="border-fault-line bg-fault-surface text-fault-ink" />
```

### The one rule about state

**State is never encoded by colour alone.** Not in a badge, not in a border, not in a 3D
material when Phase 7 arrives.

`StatusBadge` and `Callout` are the only components allowed to express one of the five states,
and both hard-wire a distinct icon per tone — a check, a triangle, an octagon, an "i", a dot.
Reach for the plain `Badge` when the label is a category rather than a status.

```tsx
<StatusBadge tone="fault">Short to ground</StatusBadge>   // icon is not optional
<Badge tone="neutral">Difficulty 3</Badge>                 // a category, no icon
```

`Input` does the same for errors: an icon plus `role="alert"`, not just a red border.

The palette backs this up rather than relying on it — `ok` sits at L30, `warn` at L38 and
`fault` at L45, so the three stay separable by lightness once their hues converge. Check it
with the picker in the `/styleguide` header, which applies a real `feColorMatrix` simulation
and keeps the choice in the URL: `/styleguide?vision=deuteranopia`.

## Type

Inter for everything, JetBrains Mono for anything measured. Both self-hosted through
`@fontsource-variable`, so no request leaves for a font CDN and there is no flash of unstyled
text.

`text-micro` 11 (small caps, `Eyebrow` only) · `xs` 12 · `sm` 14 · `base` 16 · `lg` 18 ·
`xl` 20 · `2xl` 24 · `display-sm` 24 · `display` 30 · `display-lg` 36 · `display-xl` 48.

Headings use `font-display`, which resolves to the same Inter — the class marks the intent and
applies the tighter tracking.

## Spacing and shape

Tailwind's default 0.25rem spacing scale is kept intact, because the sizing utilities
(`size-*`, `w-*`, `max-h-*`) all read from it. The house convention is narrower: use
**1, 2, 3, 4, 6, 8, 10, 12, 14, 16** for padding and gap.

Radius, by role:

| Role                            | Class            |
| ------------------------------- | ---------------- |
| Buttons, badges, chips, avatars | `rounded-pill`   |
| Inputs, selects, textareas      | `rounded-md` (8) |
| Menu rows, code chips           | `rounded-sm` (6) |
| Cards, dropdowns, toasts        | `rounded-card` (12) |
| Dialogs, empty states           | `rounded-panel` (16) |

## Focus

One global rule in `src/index.css` gives every `:focus-visible` element the same ring. Do not
add per-component focus styles, and do not remove the ring — if it looks wrong on a component,
that component's padding is wrong.

## Strings

**No user-visible English is written in a component.** Every string goes through `useT()` and
lives in `src/i18n/en.ts`; `fil.ts` is typed as `Catalog`, so a key that exists in one and not
the other is a build error rather than a blank label.

```tsx
const t = useT()
<h1>{t('settings.title')}</h1>
<p>{t('checkEmail.body', { email })}</p>
```

Technical vocabulary — netlist, breadboard, resistor, node, rail — stays in English in both
catalogues. The reasoning is at the top of `fil.ts`.

`/styleguide` is exempt: it is a development tool that ships to no student.

## Accessibility preferences

`usePreferences` (in `src/app/preferences.ts`) holds `theme`, `highContrast`, `reducedMotion`
and `largerText`. `PreferencesEffect` mirrors them onto `<html>` as classes, and an inline
script in `index.html` applies the same classes before first paint.

They are persisted **twice**: to `localStorage` so a signed-out visitor keeps their choice, and
to `profiles.preferences` so it follows a student to a lab machine. `/settings` writes both —
local first so the switch is visible immediately, then the round trip.

Light is the default. Dark is applied only when the person has chosen it, or chosen "system"
and their OS is dark; an unset preference means light.

## Adding a primitive

1. Build it in `src/components/ui/`, on a Radix primitive where one exists.
2. Use CVA for variants. Take `className` last and merge with `cn()` so callers can override.
3. `forwardRef` if it wraps a DOM node.
4. Export it from `src/components/ui/index.ts`.
5. Put every user-visible string behind a prop, so the caller supplies a translated one.
6. **Add it to `/styleguide`, in every state it has.** If it is not on that page, it does not
   exist.
