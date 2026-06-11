'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'

interface EditableImageProps {
  configKey: string
  src: string
  alt: string
  fill?: boolean
  width?: number
  height?: number
  className?: string
  sizes?: string
}

export default function EditableImage({
  configKey,
  src,
  alt,
  fill,
  width,
  height,
  className = '',
  sizes,
}: EditableImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'saved'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    setStatus('uploading')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('clave', configKey)

    try {
      const res = await fetch('/api/admin/config', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.url) {
        setCurrentSrc(data.url)
        setStatus('saved')
        window.dispatchEvent(new CustomEvent('config_saved'))
      } else {
        setStatus('idle')
      }
    } catch {
      setStatus('idle')
    }
    setTimeout(() => setStatus('idle'), 2500)
  }

  return (
    <span
      className="relative group/img inline-block cursor-pointer"
      onClick={() => inputRef.current?.click()}
      title="Clic para cambiar imagen"
    >
      {fill ? (
        <span className="absolute inset-0">
          <Image
            src={currentSrc}
            alt={alt}
            fill
            className={className}
            sizes={sizes}
            unoptimized={currentSrc.startsWith('/')}
          />
        </span>
      ) : (
        <Image
          src={currentSrc}
          alt={alt}
          width={width ?? 800}
          height={height ?? 600}
          className={className}
          sizes={sizes}
          unoptimized={currentSrc.startsWith('/')}
        />
      )}

      {/* Overlay al hover */}
      <span className="absolute inset-0 bg-blue-500/0 group-hover/img:bg-blue-500/20 transition-colors flex items-center justify-center rounded pointer-events-none">
        <span className="opacity-0 group-hover/img:opacity-100 transition-opacity bg-white/90 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
          {status === 'idle' && '📷 Cambiar imagen'}
          {status === 'uploading' && 'Subiendo...'}
          {status === 'saved' && '✅ ¡Guardado!'}
        </span>
      </span>

      <span className="absolute inset-0 ring-2 ring-transparent group-hover/img:ring-blue-400/60 rounded transition-all pointer-events-none" />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleUpload(f)
        }}
      />
    </span>
  )
}
