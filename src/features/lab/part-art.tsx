import { cn } from '@/lib/utils'
import type { BomItem, ComponentType } from '@shared/contracts'

/**
 * The parts, drawn as the objects they are — a tan resistor with its real
 * colour bands, a domed LED, an electrolytic can, a TO-92 — in the flat-shaded
 * pseudo-3D style of the reference product. A student who has held the kit
 * recognises these at a glance, which is the entire point of a tray.
 *
 * ---------------------------------------------------------------------------
 * WHY THESE COLOURS ARE LITERAL AND NOT TOKENS
 *
 * The same rule as the rail stripes in `breadboard.tsx`: this is *paint*, not
 * state. A resistor is tan with red-red-brown bands in dark mode too, because
 * the bands are how the value is read — recolouring them to fit the palette
 * would make the drawing lie about the one thing it exists to say. Everything
 * around the parts (holes, labels, focus, status) still speaks tokens.
 * ---------------------------------------------------------------------------
 *
 * Every body is drawn in a local frame: x runs along the part's own axis, and
 * the caller has already translated to the midpoint and rotated. `<PartDefs>`
 * must be present once in any SVG that renders these — gradients are
 * referenced by id, and ids resolve document-wide, so identical defs in two
 * SVGs are harmless.
 */

/* -------------------------------------------------------------------------- */
/* Shared paint                                                                */
/* -------------------------------------------------------------------------- */

const LEAD = '#b9c0c8'

export function PartDefs() {
  return (
    <defs>
      <linearGradient id="pa-resistor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#eed7ac" />
        <stop offset="0.45" stopColor="#dcbe90" />
        <stop offset="1" stopColor="#b8945e" />
      </linearGradient>
      <radialGradient id="pa-led" cx="0.35" cy="0.3" r="0.9">
        <stop offset="0" stopColor="#ff9d9d" />
        <stop offset="0.55" stopColor="#e5484d" />
        <stop offset="1" stopColor="#a51e23" />
      </radialGradient>
      <radialGradient id="pa-led-lit" cx="0.4" cy="0.35" r="0.9">
        <stop offset="0" stopColor="#fff4f3" />
        <stop offset="0.4" stopColor="#ff8a8a" />
        <stop offset="1" stopColor="#e5484d" />
      </radialGradient>
      <radialGradient id="pa-glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ff6b6b" stopOpacity="0.55" />
        <stop offset="0.6" stopColor="#ff6b6b" stopOpacity="0.22" />
        <stop offset="1" stopColor="#ff6b6b" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="pa-can" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#565e6a" />
        <stop offset="0.5" stopColor="#3a414c" />
        <stop offset="1" stopColor="#23272e" />
      </linearGradient>
      <radialGradient id="pa-can-top" cx="0.4" cy="0.35" r="0.8">
        <stop offset="0" stopColor="#c7cdd6" />
        <stop offset="1" stopColor="#8a929d" />
      </radialGradient>
      <radialGradient id="pa-disc" cx="0.4" cy="0.35" r="0.9">
        <stop offset="0" stopColor="#e8a25c" />
        <stop offset="0.6" stopColor="#c8742a" />
        <stop offset="1" stopColor="#9c5518" />
      </radialGradient>
      <linearGradient id="pa-epoxy" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#474e58" />
        <stop offset="1" stopColor="#22262c" />
      </linearGradient>
    </defs>
  )
}

/* -------------------------------------------------------------------------- */
/* The resistor colour code                                                    */
/* -------------------------------------------------------------------------- */

const DIGIT_COLOURS = [
  '#1f1f1f', // 0 black
  '#7b4a12', // 1 brown
  '#d33131', // 2 red
  '#e07f1f', // 3 orange
  '#e6c229', // 4 yellow
  '#3d8b40', // 5 green
  '#2f6fd0', // 6 blue
  '#7d4bc4', // 7 violet
  '#8a8f98', // 8 grey
  '#f2f2f2', // 9 white
]

const GOLD = '#caa64b'

/**
 * "220Ω" → red · red · brown. The bands are computed from the BOM value, so
 * the drawing teaches the code instead of wearing a generic costume — a 1kΩ
 * and a 10kΩ on the same board genuinely look different, exactly as they do
 * in the tray in the lab.
 */
export function bandsFor(value: string | null): [string, string, string] {
  const fallback: [string, string, string] = ['#d33131', '#d33131', '#7b4a12']
  if (value === null) return fallback

  const match = /([\d.]+)\s*([kKmM]?)/.exec(value)
  if (!match || match[1] === undefined) return fallback

  const scale = match[2] === 'k' || match[2] === 'K' ? 1e3 : match[2] === 'm' || match[2] === 'M' ? 1e6 : 1
  const ohms = Number(match[1]) * scale
  if (!Number.isFinite(ohms) || ohms < 10) return fallback

  const exponent = Math.floor(Math.log10(ohms)) - 1
  const base = Math.round(ohms / 10 ** exponent)
  const first = DIGIT_COLOURS[Math.floor(base / 10) % 10]
  const second = DIGIT_COLOURS[base % 10]
  const multiplier = DIGIT_COLOURS[Math.min(9, Math.max(0, exponent))]

  return [first ?? fallback[0], second ?? fallback[1], multiplier ?? fallback[2]]
}

/* -------------------------------------------------------------------------- */
/* Bodies, in the local frame                                                  */
/* -------------------------------------------------------------------------- */

function Leads({ length, gap }: { length: number; gap: number }) {
  return (
    <g>
      <line x1={-length / 2} y1={0} x2={-gap} y2={0} stroke={LEAD} strokeWidth={2.5} strokeLinecap="round" />
      <line x1={gap} y1={0} x2={length / 2} y2={0} stroke={LEAD} strokeWidth={2.5} strokeLinecap="round" />
    </g>
  )
}

export function ResistorArt({ length, value }: { length: number; value: string | null }) {
  const bodyHalf = Math.min(24, Math.max(14, length * 0.3))
  const bands = bandsFor(value)

  return (
    <g>
      <Leads length={length} gap={bodyHalf - 2} />
      <rect
        x={-bodyHalf}
        y={-9}
        width={bodyHalf * 2}
        height={18}
        rx={8}
        fill="url(#pa-resistor)"
        stroke="#9c7d4e"
        strokeWidth={0.8}
      />
      {/* The bulged ends of a real film resistor. */}
      <rect
        x={-bodyHalf}
        y={-9.8}
        width={7}
        height={19.6}
        rx={3.5}
        fill="#c9a26e"
        stroke="#9c7d4e"
        strokeWidth={0.6}
      />
      <rect
        x={bodyHalf - 7}
        y={-9.8}
        width={7}
        height={19.6}
        rx={3.5}
        fill="#c9a26e"
        stroke="#9c7d4e"
        strokeWidth={0.6}
      />
      {bands.map((colour, index) => (
        <rect key={index} x={-bodyHalf + 10 + index * 7} y={-9} width={3.6} height={18} fill={colour} />
      ))}
      {/* Tolerance band, gold, off by the far end — the way it is read. */}
      <rect x={bodyHalf - 12} y={-9} width={3.6} height={18} fill={GOLD} />
    </g>
  )
}

/** The dome from above: bright plastic, a highlight, and a flat on the cathode side. */
export function LedArt({ length, lit }: { length: number; lit: boolean }) {
  return (
    <g>
      <Leads length={length} gap={11} />
      {lit ? <circle r={30} fill="url(#pa-glow)" className="animate-fade-in" /> : null}
      <circle r={12} fill={lit ? 'url(#pa-led-lit)' : 'url(#pa-led)'} stroke="#8f181c" strokeWidth={1} />
      {/* The flat that marks the cathode — pin 2's side. */}
      <line x1={9} y1={-7.5} x2={9} y2={7.5} stroke="#8f181c" strokeWidth={1.8} />
      {lit ? null : <ellipse cx={-4} cy={-4.5} rx={3.6} ry={2.4} fill="#ffffff" opacity={0.55} />}
    </g>
  )
}

/** Electrolytic can for µF values, ceramic disc for the small stuff. */
export function CapacitorArt({ length, value }: { length: number; value: string | null }) {
  const electrolytic = value !== null && /[µu]F/i.test(value)

  if (electrolytic) {
    return (
      <g>
        <Leads length={length} gap={10} />
        <circle r={11} fill="url(#pa-can)" stroke="#14171c" strokeWidth={1} />
        <circle r={8} fill="url(#pa-can-top)" stroke="#5b626d" strokeWidth={0.7} />
        {/* The scored vent every real can carries. */}
        <line x1={-4.5} y1={0} x2={4.5} y2={0} stroke="#6d747f" strokeWidth={1} />
        <line x1={0} y1={-4.5} x2={0} y2={4.5} stroke="#6d747f" strokeWidth={1} />
      </g>
    )
  }

  return (
    <g>
      <Leads length={length} gap={8} />
      <ellipse rx={11} ry={9.5} fill="url(#pa-disc)" stroke="#8a5218" strokeWidth={1} />
      <ellipse cx={-3} cy={-3} rx={3.5} ry={2.2} fill="#ffffff" opacity={0.35} />
    </g>
  )
}

export function DiodeArt({ length }: { length: number }) {
  const bodyHalf = Math.min(16, Math.max(11, length * 0.24))

  return (
    <g>
      <Leads length={length} gap={bodyHalf - 2} />
      <rect
        x={-bodyHalf}
        y={-7}
        width={bodyHalf * 2}
        height={14}
        rx={6}
        fill="url(#pa-epoxy)"
        stroke="#14171c"
        strokeWidth={0.8}
      />
      {/* The silver cathode band. */}
      <rect x={bodyHalf - 9} y={-7} width={4} height={14} fill="#c6ccd4" />
    </g>
  )
}

/**
 * TO-92 from above: the black epoxy D, flat face toward the reader, its part
 * number printed on it. Drawn around the *base* pin; the legs fan to the
 * given x offsets.
 */
export function TransistorArt({ legOffsets, marking }: { legOffsets: number[]; marking: string | null }) {
  return (
    <g>
      {legOffsets.map((dx, index) => (
        <line
          key={index}
          x1={dx}
          y1={0}
          x2={dx * 0.55}
          y2={-9}
          stroke={LEAD}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ))}
      <path
        d="M -30 -8 L 30 -8 A 30 27 0 0 0 -30 -8 Z"
        fill="url(#pa-epoxy)"
        stroke="#14171c"
        strokeWidth={1}
      />
      <text
        y={-14}
        textAnchor="middle"
        fill="#d7dbe0"
        style={{ font: '600 8.5px "JetBrains Mono", monospace', letterSpacing: '0.04em' }}
      >
        {marking ?? 'NPN'}
      </text>
    </g>
  )
}

/**
 * A jumper in absolute coordinates: insulation arcing between two moulded
 * plugs. The insulation keeps the semantic strokes — red off +5V, blue off
 * ground, accent in between — which is also how a real kit is colour-coded.
 */
export function JumperArt({
  a,
  b,
  strokeClass,
  dashed = false,
}: {
  a: { x: number; y: number }
  b: { x: number; y: number }
  strokeClass: string
  dashed?: boolean
}) {
  const midX = (a.x + b.x) / 2
  const lift = Math.max(24, Math.abs(b.x - a.x) * 0.35)
  const controlY = (a.y + b.y) / 2 - lift

  return (
    <g>
      <path
        d={`M ${a.x} ${a.y} Q ${midX} ${controlY} ${b.x} ${b.y}`}
        className={cn(strokeClass, 'opacity-90')}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeDasharray={dashed ? '7 6' : undefined}
        fill="none"
      />
      {dashed ? null : (
        <>
          <Plug at={a} />
          <Plug at={b} />
        </>
      )}
    </g>
  )
}

function Plug({ at }: { at: { x: number; y: number } }) {
  return (
    <g>
      <circle cx={at.x} cy={at.y} r={4.6} fill="#3a4048" stroke="#14171c" strokeWidth={0.8} />
      <circle cx={at.x - 1.2} cy={at.y - 1.2} r={1.4} fill="#6d747f" />
    </g>
  )
}

/* -------------------------------------------------------------------------- */
/* Tray thumbnails                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The part as a picture, for the tray card — the same art the board renders,
 * so what you pick is literally what lands. A part the board cannot seat gets
 * no thumbnail and the card says why instead.
 */
export function PartThumb({ item, className }: { item: BomItem; className?: string }) {
  return (
    <svg viewBox="-42 -26 84 48" aria-hidden="true" className={cn('h-12 w-full', className)}>
      <PartDefs />
      <Thumb type={item.type} value={item.value} />
    </svg>
  )
}

function Thumb({ type, value }: { type: ComponentType; value: string | null }) {
  switch (type) {
    case 'resistor':
      return <ResistorArt length={80} value={value} />
    case 'led':
      return <LedArt length={62} lit={false} />
    case 'capacitor':
      return <CapacitorArt length={66} value={value} />
    case 'diode':
      return <DiodeArt length={72} />
    case 'transistor':
      return (
        <g transform="translate(0 16)">
          <TransistorArt legOffsets={[-14, 0, 14]} marking={value} />
        </g>
      )
    case 'jumper':
      return <JumperArt a={{ x: -30, y: 16 }} b={{ x: 30, y: 16 }} strokeClass="stroke-accent" />
    case 'ic':
      return null
  }
}
