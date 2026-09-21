# Design brief — the visual language

This is the contract every screen and primitive is built against. Read it before touching
anything under `src/components/` or `src/features/`.

The target is **a teaching tool that looks like a teaching tool**: white, blue, plainly
laboured over, and boring in the way a good instrument is boring. The references are
[Tinkercad](https://www.tinkercad.com/) — the closest thing to a direct competitor, and a
product two of our users have almost certainly already used — and ordinary well-built
education software.

Two audiences, and they want the same thing: a second-year electronics student who has ten
minutes before the lab starts, and the lecturer marking thirty of their attempts. Neither is
here to admire the interface. Every decision below resolves in favour of the person trying to
get something done.

---

## What changed, and why it is written down

An earlier version of this system was dark, near-black, with a lime accent, a display
typeface at 48px, pill-shaped text inputs, a `$ ls ./exercises` terminal line above every
page title and a scrolling marquee of jargon on the landing page.

It looked good. It was also aimed at a developer reading a portfolio, which is not who opens
this app. The terminal motif in particular told a student nothing except that the tool was
built by someone who likes terminals.

The history is here so nobody re-derives those moves from scratch. If a change makes the app
look more *distinctive* at the cost of a student reading a label more slowly, it is the wrong
change.

---

## The five decisions that carry the system

**1. Light, and mostly white.** The page is `bg-900`, a very faint cool grey. Surfaces —
cards, inputs, the header — are `bg-800`, pure white, separated from the page by a 1px rule.
That is where depth comes from. There is no texture, no gradient, and almost no shadow.

**2. One blue, used boldly.** `accent` is the primary action, the active nav item, the focus
ring, the mark in the header, and the full-bleed band on the landing hero and the auth aside.
It is not a timid grey app with blue links. It *is* blue, in the places that matter, and grey
everywhere else.

**3. Conventional state colours.** Green is right, amber is a warning, red is wrong, blue is
information. A diagnostic trainer is the wrong place to teach someone a private colour
vocabulary before it has taught them anything about circuits. (In the previous system `ok` and
the brand accent were the same lime — that is gone.)

**4. Pills for buttons, 8px for everything you type into.** Both reference products do
exactly this and it is a useful split: the pill says "press me" at a glance, while a
pill-shaped *input* says consumer app and squeezes a long value at both ends. Surfaces get
`rounded-card` (12px), dialogs `rounded-panel` (16px), badges and chips and the switch track
are pills because they genuinely are pills.

**5. Sentence case, always.** Field labels, buttons, nav items, step names. The only
uppercase left in the system is `Eyebrow`, the small section label above a heading, at 11px
and 0.06em. All-caps is measurably slower to read, and on a form the label is the thing
telling somebody what to type.

---

## Tokens

Colour, radius and elevation live in `src/styles/tokens.css` and are mapped in
`tailwind.config.ts`. Tailwind's stock palette is **deleted** — `bg-red-500` does not compile.
The only colours are:

| Group   | Names                                                              |
| ------- | ------------------------------------------------------------------ |
| Grounds | `bg-900` page · `bg-800` surface · `bg-700` raised · `bg-600` edge |
| Rules   | `border-line` · `border-line-strong`                                |
| Ink     | `text-primary` · `text-secondary` · `text-tertiary` · `text-inverse` |
| Accent  | `accent` · `accent-ink` (hover) · `accent-contrast` (ink on accent) |
| States  | `ok` `warn` `fault` `info` `neutral`, each with `-surface` `-line` `-ink` |

Dark is a full peer, kept because a lab at 7pm with the overheads off is a real place. It is a
variable swap in the same file, and it is the *second* thing to check, not the first — the
palette is designed against white.

## Type

One family. `font-sans` and `font-display` both resolve to **Inter**, self-hosted; a heading
is marked as one in the markup and set tighter and heavier rather than in a different face.
`font-mono` is JetBrains Mono, and it earns its place on anything a person has to transcribe —
node ids, resistances, class join codes, where a zero and an O must not look alike.

The scale is continuous: `micro` 11 · `xs` 12 · `sm` 14 · `base` 16 · `lg` 18 · `xl` 20 ·
`2xl` 24, then `display-sm` 24 · `display` 30 · `display-lg` 36 · `display-xl` 48. Body copy
is 16px, not a step below the browser default.

## Motion

`animate-rise-in` for content entering and `stagger-1` … `stagger-6` to offset siblings, at
40ms steps. Easing is `ease-out`. Nothing bounces, nothing spins except the spinner, and
nothing moves under the cursor on hover — a control that shifts when you point at it is harder
to hit, and that cost lands hardest on the people the accessibility settings exist for.

All of it vanishes under `.reduce-motion`, handled globally in `index.css`. Do not add inline
`transition` styles that bypass it.

---

## Components that carry the character

- **`<Eyebrow>`** — the 11px small-caps label above a heading. The only uppercase in the app.
- **`<StatBlock>`** — a headline number over its label.
- **`<Callout>`** — the block-level message a form needs when it has something to say that
  does not attach to one field. One icon shape per tone.
- **`<Stepper>`** — progress through the onboarding wizard. Three steps, no longer.
- **`<SegmentedControl>`** — a choice between two or three options the person makes once.
- **`<DifficultyMeter>`** — five bars filled to the level. It replaced a badge reading
  "Difficulty 3 of 5", which was correct and slow: in a list of eight exercises that is eight
  sentences to compare where this is one shape. The sentence survives as the accessible name,
  so nothing is lost by not being able to see the bars. It is a quantity rather than one of the
  five states, so it draws in the accent, and the "never colour alone" rule is met by the fill
  *count* carrying the reading — three filled bars are three filled bars in greyscale. In a
  row of metadata it is captioned with its own noun; pips alone are a shape nobody has been
  taught to read yet.
- **`<Breadboard>`** — the one drawing in the product, in `src/components/board/`. A
  component with props, not a picture: it takes which nets are lit, which one is focused,
  where the scan has reached and whether the ground jumper is in the wrong bank. Every colour
  is a token, so it follows the theme and the high-contrast setting. There is no photograph of
  a board anywhere and there should not be one — a photo cannot light a single net, which is
  the only thing this drawing exists to do.
  Two things its `crop` prop has already got wrong, so nobody re-derives them: a band that
  shows only the upper bank **cuts the LED in half**, because the circuit runs through the
  centre channel and that is the entire point of it; and putting the board inside a fixed
  `aspect-[…]` box letterboxes the viewBox rather than filling the box, so the panel is part
  drawing and part blank. Give it a width and let it choose its own height.
- **`<BoardStage dimensional>`** — the same board in WebGL, in `board-3d.tsx`. It is
  code-split behind `React.lazy` and the *flat board is its Suspense fallback*, so the hero is
  correct and interactive from first paint and the 3D scene is a genuine progressive
  enhancement: no WebGL, a blocked chunk or a slow device all degrade to a board that works.
  Its colours are read out of `tokens.css` at runtime rather than hardcoded, so it follows the
  theme and high contrast like everything else. Two rules it exists under: the entry bundle
  must never contain three.js, and no runtime asset may be fetched from a third party — drei's
  `<Environment preset>` is banned for exactly that reason.
- **`<BlueprintBackdrop>`** — the drafting grid behind the light sections, at the board's own
  0.1in pitch and about four per cent opacity. It exists because three white blocks stacked in a
  row read as unfinished rather than as restrained.
- **`<CircuitBackdrop>`** — the hero background. Printed-circuit routing generated in SVG, not
  a photograph or a video: it costs about two kilobytes, needs no licence, follows the accent,
  and cannot fight the headline because the scrim over it is part of the component.
- **`<BoardShowcase>`** — the landing hero. The board builds itself, is scanned, and is read
  out as a netlist with one net missing. It is the only thing in the product that moves on its
  own, and it earns that by *being* the explanation rather than decorating one. It stops dead
  under `.reduce-motion` and shows the finished board instead — a JavaScript timeline cannot
  be silenced by zeroing CSS durations, so it checks the preference itself.
- The **auth aside**: a blue full-height panel with the same board, held still, and the
  netlist it extracts to. It is the one large area of colour in the product and it appears
  only before sign-in. Static on purpose: it sits beside a password field.

## Composition rules

- **Page heads**: `PageHeader` — breadcrumb, 24px title, one line of prose, actions on the
  right, hairline underneath. Left-aligned. The header spans the shell; only its *contents*
  are constrained, so its rule reaches both edges.
- **The landing page is the exception** and may centre its section headings. A front page is
  read like a page; a workspace is scanned like a tool.
- **Grids**: even and predictable. Four equal cards is the right answer for four equal things.
- **Empty states**: designed, never blank. Every list has one.
- **State**: never colour alone. `StatusBadge` and `Callout` require an icon per tone; `Field`
  shows an icon with its error. This is a hard rule — the accessibility claim depends on it.
- **Icons**: lucide only, `size-4` in UI. No emoji in product chrome.
- **One primary action per screen.** Everything else is `secondary`, `ghost` or `link`.

## Checking your work

`/styleguide` renders every primitive in every state and has a colour-vision simulator in its
header:

```
/styleguide?vision=deuteranopia
```

If a component is not on that page, it does not exist. Add it there in the same change.

## The dashboard

`/dashboard` leads with **one** thing: the exercise to start or resume, given the full width and
a picture of the board it builds. Everything else is a list beneath it.

That shape is not a preference, it is the seed data. A student in week one is in one class with
one published exercise, and a three-across grid of exercise cards holding a single card looks
broken. A layout that reads correctly at length one and simply gains rows is the only one that
survives both the demo and week twelve.

**The list beneath it is not optional.** The first version of this screen had the featured
exercise, three counts and the class cards — and nothing else, which meant a student with six
assigned exercises could reach one of them. It looked finished because the demo account had one
exercise. Rows rather than cards for the same reason the featured panel exists: six cards
three-across is two rows and a hole where the seventh would be, where six rows is six rows at
any count and any width. Unfinished first, finished last. The featured exercise is *marked* in
the list rather than removed from it — a list that quietly omits a row is a list you cannot
count.

Every figure on it comes from a real endpoint — `GET /api/classes` and `GET /api/exercises`.
There is no "progress over time", because nothing produces one. `completed / assigned` right
now is a fact and is drawn as one; anything with a time axis would be invented.

The board picture on it is held still. The landing hero is the only thing in the product that
animates on its own and it earns that by *being* the explanation; a workspace screen that
redraws itself while you read it is only harder to read.
