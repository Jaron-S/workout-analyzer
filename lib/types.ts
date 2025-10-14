export interface MuscleWeighting {
  muscle: string
  weighting: number
}

export interface Exercise {
  id: string
  name: string
  muscle_weightings: MuscleWeighting[]
  movement_pattern: string
}

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
