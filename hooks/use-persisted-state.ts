"use client"

import { useState, useEffect, useCallback } from "react"

export function usePersistedState<T>(
  key: string,
  initialValue: T,
  saveToStorage: (value: T) => void,
  loadFromStorage: () => T | null,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(initialValue)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from storage on mount
  useEffect(() => {
    const stored = loadFromStorage()
    if (stored !== null) {
      setState(stored)
    }
    setIsLoaded(true)
  }, [loadFromStorage])

  // Save to storage whenever state changes (after initial load)
  useEffect(() => {
    if (isLoaded) {
      saveToStorage(state)
    }
  }, [state, isLoaded, saveToStorage])

  const setPersistedState = useCallback((value: T | ((prev: T) => T)) => {
    setState(value)
  }, [])

  return [state, setPersistedState]
}
