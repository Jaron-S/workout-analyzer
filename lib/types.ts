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
}

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

export interface RoutineExercise {
  exerciseId: string
  sets: number
}

export interface WorkoutDay {
  id: string
  name: string
  exercises: RoutineExercise[]
}

export interface Routine {
  id: string
  name: string
  days: WorkoutDay[]
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
