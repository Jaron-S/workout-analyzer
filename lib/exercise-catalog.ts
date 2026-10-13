import hevyExercises from "@/data/hevy-exercises.json";
import weightings from "@/data/exercise-weightings.json";
import legacyExercises from "@/data/legacy-exercises.json";
import legacyExerciseMap from "@/data/legacy-exercise-map.json";
import type {
	Exercise,
	MuscleOverrides,
	MuscleWeighting,
	Routine,
} from "./types";

type WeightingEntry = {
	title: string;
	muscles: Record<string, number>;
	compound?: boolean;
};
const WEIGHTINGS = weightings as Record<string, WeightingEntry>;
const LEGACY_MAP = legacyExerciseMap as Record<string, string>;

export function toMuscleWeightings(
	muscles: Record<string, number>
): MuscleWeighting[] {
	return Object.entries(muscles)
		.map(([muscle, weighting]) => ({ muscle, weighting }))
		.sort((a, b) => b.weighting - a.weighting);
}

// Hevy's built-in exercises. scripts/check-exercises.mjs guarantees each one
// has an entry in exercise-weightings.json.
const BUILT_IN_EXERCISES: Exercise[] = hevyExercises.map((e) => ({
	id: e.id,
	name: e.title,
	type: e.type,
	equipment: e.equipment,
	thumbnailUrl: e.thumbnail_url,
	muscle_weightings: toMuscleWeightings(WEIGHTINGS[e.id]?.muscles ?? {}),
	compound: WEIGHTINGS[e.id]?.compound ?? false,
}));

const LEGACY_EXERCISES: Exercise[] = legacyExercises.map((e) => ({
	...e,
	legacy: true,
}));

/** Default weightings for an exercise, before any user override. */
export function getDefaultWeightings(id: string): MuscleWeighting[] | undefined {
	return [...BUILT_IN_EXERCISES, ...LEGACY_EXERCISES].find((e) => e.id === id)
		?.muscle_weightings;
}

/**
 * The full exercise list for a user: Hevy built-ins, their Hevy custom
 * exercises and legacy exercises, with the user's own muscle weightings
 * applied where they have set them.
 */
export function buildCatalog(
	overrides: MuscleOverrides,
	customExercises: Exercise[] = []
): Exercise[] {
	return [...BUILT_IN_EXERCISES, ...customExercises, ...LEGACY_EXERCISES].map((e) =>
		overrides[e.id]
			? {
					...e,
					muscle_weightings: toMuscleWeightings(overrides[e.id]),
					customWeightings: true,
					estimatedWeightings: false,
			  }
			: e
	);
}

/**
 * Converts routines saved before the switch to Hevy exercises ("ex1" IDs) to
 * Hevy IDs. Old exercises with no Hevy built-in keep their ID and resolve to
 * a legacy exercise. Safe to run on already-converted routines.
 */
export function migrateRoutine(routine: Routine): Routine {
	const needsMigration = routine.days.some((day) =>
		day.exercises.some((ex) => LEGACY_MAP[ex.exerciseId])
	);
	if (!needsMigration) return routine;
	return {
		...routine,
		days: routine.days.map((day) => ({
			...day,
			exercises: day.exercises.map((ex) => ({
				...ex,
				exerciseId: LEGACY_MAP[ex.exerciseId] ?? ex.exerciseId,
			})),
		})),
	};
}
