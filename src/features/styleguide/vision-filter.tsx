import { Eye } from 'lucide-react'

import {
  Field,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'

export type VisionMode = 'normal' | 'deuteranopia' | 'protanopia' | 'tritanopia' | 'achromatopsia'

/**
 * One line each, deliberately: Radix clones the selected item's text into the
 * closed trigger, so a two-line item would make the control two lines tall.
 */
export const visionLabels: Record<VisionMode, string> = {
  normal: 'Normal vision',
  deuteranopia: 'Deuteranopia · red–green',
  protanopia: 'Protanopia · red–green',
  tritanopia: 'Tritanopia · blue–yellow',
  achromatopsia: 'Achromatopsia · no colour',
}

/**
 * Colour-vision simulation matrices, so the Phase 1 accessibility DoD is a
 * thing you can actually run rather than a claim in a document. Values are the
 * standard Brettel/Viénot dichromacy approximations.
 */
export function VisionFilters() {
  return (
    <svg aria-hidden="true" className="absolute size-0" focusable="false">
      <defs>
        <filter id="sim-deuteranopia">
          <feColorMatrix
            type="matrix"
            values="0.625 0.375 0 0 0
                    0.700 0.300 0 0 0
                    0.000 0.300 0.7 0 0
                    0 0 0 1 0"
          />
        </filter>
        <filter id="sim-protanopia">
          <feColorMatrix
            type="matrix"
            values="0.567 0.433 0.000 0 0
                    0.558 0.442 0.000 0 0
                    0.000 0.242 0.758 0 0
                    0 0 0 1 0"
          />
        </filter>
        <filter id="sim-tritanopia">
          <feColorMatrix
            type="matrix"
            values="0.950 0.050 0.000 0 0
                    0.000 0.433 0.567 0 0
                    0.000 0.475 0.525 0 0
                    0 0 0 1 0"
          />
        </filter>
        <filter id="sim-achromatopsia">
          <feColorMatrix
            type="matrix"
            values="0.299 0.587 0.114 0 0
                    0.299 0.587 0.114 0 0
                    0.299 0.587 0.114 0 0
                    0 0 0 1 0"
          />
        </filter>
      </defs>
    </svg>
  )
}

/** Narrows an untrusted ?vision= value, falling back to no simulation. */
export function parseVisionMode(value: string | null): VisionMode {
  return value && value in visionLabels ? (value as VisionMode) : 'normal'
}

export function visionStyle(mode: VisionMode) {
  return mode === 'normal' ? undefined : { filter: `url(#sim-${mode})` }
}

/**
 * The header control. It is a `Field` rather than a bare select so the label,
 * the id wiring and the live note underneath all come from the same primitive
 * the rest of the page documents — the simulator should not be the one control
 * on the page that opts out of the system.
 */
export function VisionPicker({
  value,
  onChange,
}: {
  value: VisionMode
  onChange: (mode: VisionMode) => void
}) {
  return (
    <Field
      className="w-full sm:w-72"
      label={
        <>
          {/* size-3.5, not the size-4 of UI chrome: this glyph is set against an
              11px label and a 16px icon would tower over it. */}
          <Eye className="size-3.5" aria-hidden="true" />
          Simulate colour vision
        </>
      }
      hint={value === 'normal' ? undefined : 'Everything below the rule is being transformed.'}
    >
      <Select value={value} onValueChange={(next) => onChange(next as VisionMode)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Dichromacy simulation</SelectLabel>
            {(Object.keys(visionLabels) as VisionMode[]).map((mode) => (
              <SelectItem key={mode} value={mode}>
                {visionLabels[mode]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}
