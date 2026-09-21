import type { Config } from 'tailwindcss'

/** Wraps a token so Tailwind can still apply an alpha modifier to it. */
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`

/**
 * Every token is a bare HSL triplet, so every one goes through `token()` and
 * every colour accepts an alpha modifier — `border-line/60` works.
 *
 * The hairlines used to be the exception, stored with their own alpha. They
 * became solid greys when the palette went light: a 10%-alpha black rule picks
 * up whatever is behind it, so the same border drifted between a white card and
 * the page it sat on.
 */

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Deliberately a *replacement*, not an extension: Tailwind's stock palette
    // is removed so `bg-red-500` fails to compile. The only colours that exist
    // are the ones in src/styles/tokens.css.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',

      bg: {
        900: token('bg-900'),
        800: token('bg-800'),
        700: token('bg-700'),
        600: token('bg-600'),
      },
      line: {
        DEFAULT: token('line'),
        strong: token('line-strong'),
      },
      text: {
        DEFAULT: token('text-primary'),
        primary: token('text-primary'),
        secondary: token('text-secondary'),
        tertiary: token('text-tertiary'),
        inverse: token('text-inverse'),
      },

      accent: {
        DEFAULT: token('accent'),
        ink: token('accent-ink'),
        contrast: token('accent-contrast'),
      },

      ok: {
        DEFAULT: token('ok'),
        surface: token('ok-surface'),
        line: token('ok-line'),
        ink: token('ok-ink'),
      },
      warn: {
        DEFAULT: token('warn'),
        surface: token('warn-surface'),
        line: token('warn-line'),
        ink: token('warn-ink'),
      },
      fault: {
        DEFAULT: token('fault'),
        surface: token('fault-surface'),
        line: token('fault-line'),
        ink: token('fault-ink'),
      },
      info: {
        DEFAULT: token('info'),
        surface: token('info-surface'),
        line: token('info-line'),
        ink: token('info-ink'),
      },
      neutral: {
        DEFAULT: token('neutral'),
        surface: token('neutral-surface'),
        line: token('neutral-line'),
        ink: token('neutral-ink'),
      },

      ring: token('ring'),
    },

    /**
     * One family for everything a person reads, and a monospace for everything
     * a person has to transcribe.
     *
     * `display` resolves to Inter as well. It is kept as a separate name so a
     * heading is still marked as one in the markup, and so a future decision to
     * introduce a second face is one line here rather than a sweep of every
     * screen — but a display typeface is not what this tool needs. See the note
     * in `src/styles/fonts.css`.
     */
    fontFamily: {
      display: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace'],
    },

    /**
     * A continuous scale with no gap in it.
     *
     * The previous one was deliberately bimodal — a tight band of small sizes,
     * then a jump straight to 40px — which is a composition device and a bad fit
     * for screens that are mostly forms and tables. A settings page needs a
     * 20px section heading, and having to choose between 17px and 22px is how a
     * layout ends up with headings that do not look like headings.
     *
     * `base` is 16px, not 15. Body text in a tool students read for an hour at a
     * time should not be a step below the browser default.
     */
    fontSize: {
      // Small caps label. 0.06em, not the 0.18em it was: extreme tracking is a
      // fashion move and it makes an 11px label genuinely harder to read.
      micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.06em' }],
      xs: ['0.75rem', { lineHeight: '1.125rem' }],
      sm: ['0.875rem', { lineHeight: '1.375rem' }],
      base: ['1rem', { lineHeight: '1.5rem' }],
      lg: ['1.125rem', { lineHeight: '1.75rem' }],
      xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
      '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.014em' }],
      'display-xs': ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
      'display-sm': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.014em' }],
      display: ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.018em' }],
      'display-lg': ['2.25rem', { lineHeight: '2.625rem', letterSpacing: '-0.02em' }],
      'display-xl': ['3rem', { lineHeight: '3.25rem', letterSpacing: '-0.022em' }],
    },

    extend: {
      // Spacing stays Tailwind's default 0.25rem scale, because the sizing
      // utilities (size-*, w-*, max-h-*) all read from it. The house
      // convention is narrower: 1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32 for
      // padding and gap.
      /**
       * An ordinary scale, and that is the point.
       *
       * It used to be bimodal too — pills for every control, 12/18px for every
       * surface, and nothing in between on purpose. A pill-shaped text input is
       * a strong stylistic claim, and on a form a student fills in every week it
       * reads as a consumer app rather than as coursework.
       *
       * So: `md` (8px) for controls, `card` (12px) for surfaces, `pill` kept for
       * the handful of things that genuinely are pills — a badge, a chip, the
       * switch track, an avatar.
       */
      borderRadius: {
        none: '0',
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        card: 'var(--radius-card)',
        panel: 'var(--radius-panel)',
        pill: '9999px',
        full: '9999px',
      },
      borderWidth: {
        hairline: '1px',
      },
      letterSpacing: {
        tighter: '-0.02em',
        tight: '-0.012em',
        normal: '0',
        wide: '0.04em',
        wider: '0.06em',
        widest: '0.1em',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        none: 'none',
      },
      maxWidth: {
        prose: '62ch',
        shell: '80rem',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(0.75rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.98)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(1.5rem)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-out-right': {
          from: { opacity: '1', transform: 'translateX(0)' },
          to: { opacity: '0', transform: 'translateX(1.5rem)' },
        },
        // A hairline that draws itself in from the left. Used under section
        // headings; it is the cheapest bit of choreography in the system.
        'rule-draw': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'caret-blink': {
          '0%, 45%': { opacity: '1' },
          '50%, 95%': { opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out both',
        'rise-in': 'rise-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slide-in-right 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-out-right': 'slide-out-right 160ms ease-in',
        'rule-draw': 'rule-draw 640ms cubic-bezier(0.16, 1, 0.3, 1) both',
        marquee: 'marquee 38s linear infinite',
        shimmer: 'shimmer 1.8s infinite',
        'caret-blink': 'caret-blink 1.1s step-end infinite',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config
