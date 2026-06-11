'use client'

import { useState, useEffect } from 'react'

/**
 * Devuelve true si la página está corriendo con ?editMode=1
 * Usa useEffect para evitar errores de hidratación SSR/CSR.
 */
export function useEditMode(): boolean {
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setEditMode(params.get('editMode') === '1')
  }, [])

  return editMode
}
