export interface MuscleWeighting {
  muscle: string
  weighting: number
}

export interface Exercise {
  /** Hevy exercise template ID, or a legacy "exN" ID for old exercises Hevy has no built-in for. */
  id: string
  name: string
  muscle_weightings: MuscleWeighting[]
  /** Hevy exercise type, e.g. "weight_reps" or "duration". Absent on legacy exercises. */
  type?: string
  equipment?: string
  thumbnailUrl?: string | null
  /** True when the user has replaced the default muscle weightings. */
  customWeightings?: boolean
  /** True for old app exercises that are not (yet) linked to a Hevy exercise. */
  legacy?: boolean
  /** Multi-joint lift; picks which training defaults (reps, rest) apply. */
  compound?: boolean
  /** One of the user's own Hevy custom exercises. */
  hevyCustom?: boolean
  /** Weightings guessed from Hevy's muscle groups, not curated or set by the user. */
  estimatedWeightings?: boolean
}

/** How a user feels about an exercise: picked first, or never suggested. */
export interface ExercisePreference {
  pref: "favourite" | "avoid"
  /** Why, in the user's words (e.g. "hard on my back"); Claude reads it. */
  note?: string
}

/** Per-user exercise preferences, keyed by exercise ID. */
export type ExercisePreferences = Record<string, ExercisePreference>

/** Per-user muscle weightings, keyed by exercise ID, replacing the defaults. */
export type MuscleOverrides = Record<string, Record<string, number>>

export interface VolumeLandmark {
  mv: number
  mev: number
  mav_min: number
  mav_max: number
  mrv: number
}

export type VolumeLandmarks = Record<string, VolumeLandmark>

export type PriorityTier = "S" | "A" | "B" | "C" | "D" | "F"

export interface PriorityPreset {
  id: string
  name: string
  tiers: Partial<Record<PriorityTier, string[]>>
}

export interface RepRange {
  min: number
  max: number
}

/** Optional per-exercise targets; anything left out uses the user's training defaults. */
export interface RoutineExercise {
  exerciseId: string
  sets: number
  reps?: RepRange
  restSeconds?: number
  /** For timed exercises such as planks. */
  durationSeconds?: number
  notes?: string
}

export interface WorkoutDay {
  id: string
  name: string
  exercises: RoutineExercise[]
}

/** Where a routine was last pushed in Hevy: a folder, and one Hevy routine per day. */
export interface HevyLink {
  folderId: number | null
  dayRoutineIds: Record<string, string>
  pushedAt: string
}

export interface Routine {
  id: string
  name: string
  days: WorkoutDay[]
  hevy?: HevyLink
}

export type WeightUnit = "lb" | "kg"

export interface TrainingDefaults {
  weightUnit: WeightUnit
  reps: { compound: RepRange; isolation: RepRange }
  restSeconds: { compound: number; isolation: number }
  durationSeconds: number
}

export interface MuscleVolume {
  muscle: string
  totalSets: number
  frequency: number
  sessionVolumes: number[]
}

export interface MovementPatternVolume {
  pattern: string
  sets: number
}
