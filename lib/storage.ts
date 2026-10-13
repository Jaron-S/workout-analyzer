"use client"

import { migrateRoutine } from "./exercise-catalog"
import type { Routine, PriorityTier, MuscleOverrides } from "./types"

const ROUTINE_KEY = "workout-analyzer-routine"
const PRIORITIES_KEY = "workout-analyzer-priorities"
const MUSCLE_OVERRIDES_KEY = "workout-analyzer-muscle-overrides"

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
    return migrateRoutine(JSON.parse(stored))
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

export function saveMuscleOverrides(overrides: MuscleOverrides): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(MUSCLE_OVERRIDES_KEY, JSON.stringify(overrides))
  } catch (error) {
    console.error("Failed to save muscle overrides:", error)
  }
}

export function loadMuscleOverrides(): MuscleOverrides | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(MUSCLE_OVERRIDES_KEY)
    if (!stored) return null
    return JSON.parse(stored)
  } catch (error) {
    console.error("Failed to load muscle overrides:", error)
    return null
  }
}

export function clearAllData(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(ROUTINE_KEY)
    localStorage.removeItem(PRIORITIES_KEY)
    localStorage.removeItem(MUSCLE_OVERRIDES_KEY)
  } catch (error) {
    console.error("Failed to clear data:", error)
  }
}
