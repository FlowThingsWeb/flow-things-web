'use client'

import { useState } from 'react'

interface EditableTextProps {
  configKey: string
  value: string
  className?: string
  as?: string
  multiline?: boolean
}

export default function EditableText({
  configKey,
  value,
  className = '',
  as: Tag = 'span',
  multiline = false,
}: EditableTextProps) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const save = async (text: string) => {
    if (text.trim() === value.trim()) return
    setStatus('saving')
    try {
      await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: configKey, valor: text }),
      })
      setStatus('saved')
      window.dispatchEvent(new CustomEvent('config_saved'))
    } catch {
      setStatus('idle')
    }
    setTimeout(() => setStatus('idle'), 2500)
  }

  const AnyTag = Tag as any

  return (
    <AnyTag
      contentEditable
      suppressContentEditableWarning
      suppressHydrationWarning
      data-edit-key={configKey}
      onBlur={async (e: React.FocusEvent<HTMLElement>) => {
        await save(e.currentTarget.textContent || '')
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (!multiline && e.key === 'Enter') {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).blur()
        }
        if (e.key === 'Escape') {
          ;(e.currentTarget as HTMLElement).blur()
        }
      }}
      title={
        status === 'idle'
          ? '✏️ Clic para editar'
          : status === 'saving'
          ? '⏳ Guardando...'
          : '✅ Guardado'
      }
      className={[
        className,
        'outline-none cursor-text transition-all duration-150',
        'ring-2 ring-inset ring-transparent rounded-sm px-0.5',
        status === 'idle' ? 'hover:ring-blue-400/60' : '',
        status === 'saving' ? 'ring-yellow-400/60' : '',
        status === 'saved' ? 'ring-green-400/60' : '',
        'focus:ring-blue-500',
      ].join(' ')}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  )
}
