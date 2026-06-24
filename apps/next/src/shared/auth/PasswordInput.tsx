import { useState } from 'react'
import { Button, InputGroup, Label, TextField } from '@heroui/react'
import { Eye, EyeOff } from 'lucide-react'

// Password field with a reveal toggle — the documented HeroUI v3 InputGroup "Password Toggle"
// pattern (TextField > Label + InputGroup > InputGroup.Input + suffix Button). Controlled.
export interface PasswordInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  isDisabled?: boolean
  minLength?: number
  /** aria-labels for the toggle button (i18n). */
  showLabel?: string
  hideLabel?: string
}

export function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  isDisabled,
  minLength,
  showLabel = 'Show password',
  hideLabel = 'Hide password',
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false)
  return (
    <TextField className="w-full" name="password" isDisabled={isDisabled}>
      <Label>{label}</Label>
      <InputGroup>
        <InputGroup.Input
          className="w-full"
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={minLength}
        />
        <InputGroup.Suffix className="pr-0">
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={isVisible ? hideLabel : showLabel}
            onPress={() => setIsVisible((v) => !v)}
          >
            {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
    </TextField>
  )
}
