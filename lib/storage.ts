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
// Like the Hevy key, the Anthropic key never leaves this device.
const CLAUDE_API_KEY_KEY = "workout-analyzer-claude-api-key"

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

/** An empty value removes the key. */
function saveSecret(key: string, value: string, label: string): void {
  if (typeof window === "undefined") return
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch (error) {
    console.error(`Failed to save ${label}:`, error)
  }
}

function loadSecret(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const saveHevyApiKey = (apiKey: string) => saveSecret(HEVY_API_KEY_KEY, apiKey, "Hevy API key")
export const loadHevyApiKey = () => loadSecret(HEVY_API_KEY_KEY)

export const saveClaudeApiKey = (apiKey: string) => saveSecret(CLAUDE_API_KEY_KEY, apiKey, "Anthropic API key")
export const loadClaudeApiKey = () => loadSecret(CLAUDE_API_KEY_KEY)

export const saveHevyCustomExercises = (templates: HevyExerciseTemplate[]) =>
  saveJson(HEVY_CUSTOM_EXERCISES_KEY, templates, "Hevy custom exercises")
export const loadHevyCustomExercises = () =>
  loadJson<HevyExerciseTemplate[]>(HEVY_CUSTOM_EXERCISES_KEY, "Hevy custom exercises")

/** JSON with sorted keys, so equal routines compare equal whatever their key order. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

// The routine as last saved to or loaded from the account, per routine id:
// local edits since then haven't reached the account yet.
const SYNCED_KEY = "workout-analyzer-synced-routine"
type Synced = { id: string; json: string; at?: string }
export const saveSyncedRoutine = (routine: Routine) =>
  saveJson(SYNCED_KEY, { id: routine.id, json: stableJson(routine), at: new Date().toISOString() }, "synced routine")
export const syncedRoutineJson = (id: string) => {
  const synced = loadJson<Synced>(SYNCED_KEY, "synced routine")
  return synced?.id === id ? synced.json : null
}
/** When this browser last synced the routine with the account (ISO), if ever. */
export const syncedRoutineAt = (id: string) => {
  const synced = loadJson<Synced>(SYNCED_KEY, "synced routine")
  return synced?.id === id ? (synced.at ?? null) : null
}

export function clearAllData(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(ROUTINE_KEY)
    localStorage.removeItem(PRIORITIES_KEY)
    localStorage.removeItem(MUSCLE_OVERRIDES_KEY)
    localStorage.removeItem(TRAINING_DEFAULTS_KEY)
    localStorage.removeItem(HEVY_API_KEY_KEY)
    localStorage.removeItem(HEVY_CUSTOM_EXERCISES_KEY)
    localStorage.removeItem(CLAUDE_API_KEY_KEY)
  } catch (error) {
    console.error("Failed to clear data:", error)
  }
}
