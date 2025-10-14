"use client"

import type { Routine, PriorityTier } from "./types"

const ROUTINE_KEY = "workout-analyzer-routine"
const PRIORITIES_KEY = "workout-analyzer-priorities"

export function saveRoutine(routine: Routine): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(ROUTINE_KEY, JSON.stringify(routine))
  } catch (error) {
    console.error("Failed to save routine:", error)
  }
}

export function loadRoutine(): Routine | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(ROUTINE_KEY)
    if (!stored) return null
    return JSON.parse(stored)
  } catch (error) {
    console.error("Failed to load routine:", error)
    return null
  }
}

export function savePriorities(priorities: Partial<Record<PriorityTier, string[]>>): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(PRIORITIES_KEY, JSON.stringify(priorities))
  } catch (error) {
    console.error("Failed to save priorities:", error)
  }
}

export function loadPriorities(): Partial<Record<PriorityTier, string[]>> | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(PRIORITIES_KEY)
    if (!stored) return null
    return JSON.parse(stored)
  } catch (error) {
    console.error("Failed to load priorities:", error)
    return null
  }
}

export function clearAllData(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(ROUTINE_KEY)
    localStorage.removeItem(PRIORITIES_KEY)
  } catch (error) {
    console.error("Failed to clear data:", error)
  }
}
