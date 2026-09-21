import { OctagonX } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * The accessible shell every form control shares.
 *
 * Label, hint, error and the aria wiring between them are defined once, here,
 * so Input / Textarea / Select / Checkbox differ only in the control they wrap.
 * Two ways in:
 *
 *   <Input label="Email" error={errors.email?.message} {...register('email')} />
 *
 *   <Field label="Role" hint="Instructors can publish exercises.">
 *     <Select>…</Select>
 *   </Field>
 *
 * The second is for compound controls that cannot own their label. It publishes
 * its ids on context, so the control inside inherits them without the caller
 * threading ids through by hand — and that control then renders only itself,
 * since the shell above it is already doing the labelling.
 *
 * One Field labels exactly one control. A set of related controls is a
 * `role="group"` with its own heading, not a Field with several children.
 */

/* -------------------------------------------------------------------------- */
/* Ids and wiring                                                              */
/* -------------------------------------------------------------------------- */

interface FieldContextValue {
  controlId: string
  /** What the control should point `aria-describedby` at, if anything. */
  describedBy: string | undefined
  invalid: boolean
}

const FieldContext = React.createContext<FieldContextValue | null>(null)

export interface FieldIds extends FieldContextValue {
  hintId: string
  errorId: string
}

export interface FieldIdOptions {
  /** Explicit control id. One is generated when absent. */
  id?: string
  hint?: React.ReactNode
  error?: React.ReactNode
}

/**
 * Derives the id set for one field. The message ids hang off the control id, so
 * a control and the shell around it reach identical ids from the same seed.
 */
export function useFieldIds({ id, hint, error }: FieldIdOptions): FieldIds {
  const generated = React.useId()
  const controlId = id ?? generated
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`

  return {
    controlId,
    hintId,
    errorId,
    // Only one message is ever on screen, so only one is ever described.
    describedBy: error ? errorId : hint ? hintId : undefined,
    invalid: Boolean(error),
  }
}

/** The Field wrapping the current control, or null when it stands alone. */
export function useFieldContext(): FieldContextValue | null {
  return React.useContext(FieldContext)
}

export interface FieldControl {
  /**
   * False when an outer Field already renders the label and message — the
   * control should return its bare self in that case.
   */
  ownsShell: boolean
  /** For a control that lays out its own shell rather than delegating to Field. */
  ids: FieldIds
  /** Spread onto the control's DOM node. */
  controlProps: {
    id: string
    'aria-invalid': true | undefined
    'aria-describedby': string | undefined
  }
}

/**
 * What a self-labelling control (Input, Textarea, Checkbox) needs: its aria
 * props, and whether it is responsible for drawing the shell around itself.
 *
 * An outer Field wins on ids and description — it is the thing rendering the
 * `<label htmlFor>` — while `invalid` is taken from either source, so a control
 * handed an error still turns red inside a shell that was not told about it.
 */
export function useFieldControl(options: FieldIdOptions & { describedBy?: string }): FieldControl {
  const outer = useFieldContext()
  const ids = useFieldIds(options)
  const describedBy = outer ? outer.describedBy : ids.describedBy
  const invalid = ids.invalid || Boolean(outer?.invalid)

  return {
    ownsShell: !outer,
    ids,
    controlProps: {
      id: options.id ?? outer?.controlId ?? ids.controlId,
      'aria-invalid': invalid || undefined,
      'aria-describedby': [options.describedBy, describedBy].filter(Boolean).join(' ') || undefined,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Surface                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The control surface every text-entry primitive shares: hairline on the raised
 * ground, firming on hover, fault-red once invalid. Radius and box are left to
 * the caller — a pill for the single-line controls, `rounded-card` for the
 * textarea, since a pill on a multi-line box looks like a mistake.
 *
 * The invalid state keys off `aria-invalid` rather than a prop, so any control
 * that wires itself up correctly is styled correctly for free.
 */
export const fieldSurface = [
  'w-full border border-line bg-bg-800 text-sm text-text-primary',
  'transition-colors duration-200 ease-out',
  'placeholder:text-text-tertiary',
  // The lime caret is the terminal motif turning up where the user is typing.
  'caret-accent',
  'hover:border-line-strong',
  'disabled:cursor-not-allowed disabled:opacity-50',
  // The border is the glance-level signal only; the message under the control
  // carries the icon and the words, because state is never colour alone.
  'aria-[invalid=true]:border-fault',
  // Chrome paints its own pale ground and dark ink over an autofilled field,
  // which on a near-black form reads as a rendering fault. An inset shadow the
  // size of the control is the only override WebKit honours.
  '[&:-webkit-autofill]:[-webkit-text-fill-color:hsl(var(--text-primary))]',
  '[&:-webkit-autofill]:[box-shadow:inset_0_0_0_100px_hsl(var(--bg-800))]',
]

/* -------------------------------------------------------------------------- */
/* Label                                                                       */
/* -------------------------------------------------------------------------- */

export interface FieldLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /**
   * Annotates the field as skippable. Mark what is optional rather than
   * asterisking what is required: in a form where most fields are mandatory,
   * the asterisk is on everything and stops carrying information.
   */
  optional?: boolean
}

/**
 * Sentence case, 14px, in the primary ink.
 *
 * It used to be an 11px wide-tracked all-caps label. All-caps is measurably
 * slower to read — the word shape that fluent readers actually recognise is
 * gone — and on a form, the label is the thing telling someone what to type. A
 * style that costs comprehension to gain character is the wrong trade on the one
 * screen a student has to get through before they can use the tool at all.
 */
export function FieldLabel({ optional = false, className, children, ...props }: FieldLabelProps) {
  return (
    <label
      className={cn('flex items-center gap-1.5 text-sm font-medium text-text-primary', className)}
      {...props}
    >
      {children}
      {/* Not aria-hidden: "optional" is information, not decoration. */}
      {optional ? <span className="font-normal text-text-tertiary">(optional)</span> : null}
    </label>
  )
}

/* -------------------------------------------------------------------------- */
/* Message                                                                     */
/* -------------------------------------------------------------------------- */

export interface FieldMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  hint?: React.ReactNode
  error?: React.ReactNode
  hintId?: string
  errorId?: string
}

/**
 * The single message slot under a control.
 *
 * An error *replaces* the hint rather than stacking under it: one slot means
 * the form does not reflow as validation comes and goes, and a hint is rarely
 * still the useful thing to say once the field has failed.
 *
 * The glyph is the octagon the `fault` StatusBadge uses — one silhouette per
 * state across the system, so the message reads with the colour taken away.
 */
export function FieldMessage({ hint, error, hintId, errorId, className, ...props }: FieldMessageProps) {
  if (error) {
    return (
      <p
        id={errorId}
        role="alert"
        className={cn('flex items-start gap-1.5 text-xs text-fault-ink', className)}
        {...props}
      >
        {/* mt-0.5 optically centres a 14px glyph on an 18px first line. */}
        <OctagonX className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>{error}</span>
      </p>
    )
  }

  if (hint) {
    return (
      <p id={hintId} className={cn('text-xs text-text-tertiary', className)} {...props}>
        {hint}
      </p>
    )
  }

  return null
}

/* -------------------------------------------------------------------------- */
/* Field                                                                       */
/* -------------------------------------------------------------------------- */

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  optional?: boolean
  /**
   * Id of the control inside. Generated when absent — pass it only when the
   * control already has an id of its own, so the two agree.
   */
  htmlFor?: string
}

export const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ htmlFor, label, hint, error, optional, className, children, ...props }, ref) => {
    const ids = useFieldIds({ id: htmlFor, hint, error })
    const context = React.useMemo<FieldContextValue>(
      () => ({ controlId: ids.controlId, describedBy: ids.describedBy, invalid: ids.invalid }),
      [ids.controlId, ids.describedBy, ids.invalid],
    )

    return (
      <div ref={ref} className={cn('flex w-full flex-col gap-2', className)} {...props}>
        {label ? (
          <FieldLabel htmlFor={ids.controlId} optional={optional}>
            {label}
          </FieldLabel>
        ) : null}
        <FieldContext.Provider value={context}>{children}</FieldContext.Provider>
        <FieldMessage hint={hint} error={error} hintId={ids.hintId} errorId={ids.errorId} />
      </div>
    )
  },
)
Field.displayName = 'Field'
