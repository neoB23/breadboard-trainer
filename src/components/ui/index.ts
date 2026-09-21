/**
 * The public surface of the primitive library.
 *
 * One block per module, modules in alphabetical order, names alphabetical
 * within a block — the file is regenerated from the modules' real exports, so
 * a mechanical order keeps the diff readable when a primitive gains a variant.
 *
 * `verbatimModuleSyntax` is on: every type re-export needs its own `type`
 * modifier or the build fails. Values and types share a block deliberately,
 * so a component and its props stay adjacent.
 *
 * Features import from here rather than reaching into a module directly; that
 * is what keeps a rename inside `ui/` from touching `src/features`.
 */

export { Badge, StatusBadge, badgeVariants, type BadgeProps, type BadgeTone } from './badge'
export { Button, TextButton, buttonVariants, type ButtonProps, type TextButtonProps } from './button'
export { Callout, type CalloutProps, type CalloutTone } from './callout'
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, type CardProps } from './card'
export { Checkbox, type CheckboxProps } from './checkbox'
export { Chip, chipVariants, type ChipProps } from './chip'
export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog'
export { DifficultyMeter, type DifficultyMeterProps } from './difficulty-meter'
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
export { EmptyState, type EmptyStateProps } from './empty-state'
// `fieldSurface` is the shared control-surface class list, exported for any
// future text-entry primitive that has to match Input and Textarea exactly.
export {
  Field,
  FieldLabel,
  FieldMessage,
  fieldSurface,
  useFieldContext,
  useFieldControl,
  useFieldIds,
  type FieldControl,
  type FieldIdOptions,
  type FieldIds,
  type FieldLabelProps,
  type FieldMessageProps,
  type FieldProps,
} from './field'
export { Input, type InputProps } from './input'
export { PasswordInput, type PasswordInputProps } from './password-input'
export { Progress, type ProgressProps, type ProgressTone } from './progress'
export { ProgressRing, type ProgressRingProps } from './progress-ring'
export { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from './segmented-control'
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  type SelectTriggerProps,
} from './select'
export {
  Eyebrow,
  Rule,
  SectionHeading,
  StatBlock,
  type EyebrowProps,
  type RuleProps,
  type SectionHeadingProps,
  type StatBlockProps,
} from './signature'
export { Skeleton, type SkeletonProps } from './skeleton'
export { Spinner, type SpinnerProps } from './spinner'
export { Stepper, type Step, type StepperProps } from './stepper'
export { Switch } from './switch'
export { Textarea, type TextareaProps } from './textarea'
export { Toaster, toast, useToasts, type ToastMessage, type ToastTone } from './toast'
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
