'use client'
import { useState } from 'react'
import { Eye, EyeOff, Copy, Check } from 'lucide-react'
import { Input } from './input'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface PasswordFieldProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  readOnly?: boolean
}

export function PasswordField({ value = '', onChange, placeholder, className, readOnly }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('relative flex items-center', className)}>
      <Input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder ?? '••••••••'}
        readOnly={readOnly}
        className="pr-20"
      />
      <div className="absolute right-2 flex items-center gap-1">
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setVisible(v => !v)}>
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}
