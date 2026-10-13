"use client"

import { migrateRoutine } from "./exercise-catalog"
import type { Routine, PriorityTier, MuscleOverrides, TrainingDefaults } from "./types"
import type { HevyExerciseTemplate } from "./hevy/client"

const ROUTINE_KEY = "workout-analyzer-routine"
const PRIORITIES_KEY = "workout-analyzer-priorities"
const MUSCLE_OVERRIDES_KEY = "workout-analyzer-muscle-overrides"
const TRAINING_DEFAULTS_KEY = "workout-analyzer-training-defaults"
// The Hevy key stays on this device: it is never synced to the account.
const HEVY_API_KEY_KEY = "workout-analyzer-hevy-api-key"
const HEVY_CUSTOM_EXERCISES_KEY = "workout-analyzer-hevy-custom-exercises"

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

function saveJson(key: string, value: unknown, label: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error(`Failed to save ${label}:`, error)
  }
}

function loadJson<T>(key: string, label: string): T | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(key)
    return stored ? (JSON.parse(stored) as T) : null
  } catch (error) {
    console.error(`Failed to load ${label}:`, error)
    return null
  }
}

export const saveTrainingDefaults = (defaults: TrainingDefaults) =>
  saveJson(TRAINING_DEFAULTS_KEY, defaults, "training defaults")
export const loadTrainingDefaults = () => loadJson<TrainingDefaults>(TRAINING_DEFAULTS_KEY, "training defaults")

/** An empty key removes it. */
export const saveHevyApiKey = (apiKey: string) => {
  if (typeof window === "undefined") return
  try {
    if (apiKey) localStorage.setItem(HEVY_API_KEY_KEY, apiKey)
    else localStorage.removeItem(HEVY_API_KEY_KEY)
  } catch (error) {
    console.error("Failed to save Hevy API key:", error)
  }
}
export const loadHevyApiKey = (): string | null => {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(HEVY_API_KEY_KEY)
  } catch {
    return null
  }
}

export const saveHevyCustomExercises = (templates: HevyExerciseTemplate[]) =>
  saveJson(HEVY_CUSTOM_EXERCISES_KEY, templates, "Hevy custom exercises")
export const loadHevyCustomExercises = () =>
  loadJson<HevyExerciseTemplate[]>(HEVY_CUSTOM_EXERCISES_KEY, "Hevy custom exercises")

export function clearAllData(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(ROUTINE_KEY)
    localStorage.removeItem(PRIORITIES_KEY)
    localStorage.removeItem(MUSCLE_OVERRIDES_KEY)
    localStorage.removeItem(TRAINING_DEFAULTS_KEY)
    localStorage.removeItem(HEVY_API_KEY_KEY)
    localStorage.removeItem(HEVY_CUSTOM_EXERCISES_KEY)
  } catch (error) {
    console.error("Failed to clear data:", error)
  }
}
