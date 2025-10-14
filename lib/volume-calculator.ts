import type { Exercise, Routine, MuscleVolume, VolumeLandmarks } from "./types"

export function calculateMuscleVolumes(routine: Routine, exercises: Exercise[]): MuscleVolume[] {
  const muscleData = new Map<string, { totalSets: number; frequency: number; sessionVolumes: number[] }>()

  // Initialize all muscles
  exercises.forEach((ex) => {
    ex.muscle_weightings.forEach((mw) => {
      if (!muscleData.has(mw.muscle)) {
        muscleData.set(mw.muscle, {
          totalSets: 0,
          frequency: 0,
          sessionVolumes: [],
        })
      }
    })
  })

  // Calculate volumes per day
  routine.days.forEach((day) => {
    const dayMuscleVolumes = new Map<string, number>()

    day.exercises.forEach((routineEx) => {
      const exercise = exercises.find((ex) => ex.id === routineEx.exerciseId)
      if (!exercise) return

      exercise.muscle_weightings.forEach((mw) => {
        const volume = routineEx.sets * mw.weighting
        dayMuscleVolumes.set(mw.muscle, (dayMuscleVolumes.get(mw.muscle) || 0) + volume)
      })
    })

    // Update muscle data with this day's volumes
    dayMuscleVolumes.forEach((volume, muscle) => {
      const data = muscleData.get(muscle)!
      data.totalSets += volume
      data.frequency += 1
      data.sessionVolumes.push(volume)
    })
  })

  return Array.from(muscleData.entries()).map(([muscle, data]) => ({
    muscle,
    ...data,
  }))
}

export function getVolumeZone(
  sets: number,
  landmarks: VolumeLandmarks,
  muscle: string,
): "below-mv" | "mv-mev" | "mev-mav" | "mav" | "mav-mrv" | "above-mrv" {
  const landmark = landmarks[muscle]
  if (!landmark) return "mev-mav"

  if (sets < landmark.mv) return "below-mv"
  if (sets < landmark.mev) return "mv-mev"
  if (sets < landmark.mav_min) return "mev-mav"
  if (sets <= landmark.mav_max) return "mav"
  if (sets <= landmark.mrv) return "mav-mrv"
  return "above-mrv"
}

export function getTotalSessionSets(
  dayExercises: { exerciseId: string; sets: number }[],
  exercises: Exercise[],
): number {
  return dayExercises.reduce((total, routineEx) => {
    return total + routineEx.sets
  }, 0)
}
