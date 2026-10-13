import type { HevyRoutine } from "./hevy/client";
import type { Exercise, RepRange, RoutineExercise, TrainingDefaults } from "./types";

export const DEFAULT_TRAINING_DEFAULTS: TrainingDefaults = {
	weightUnit: "lb",
	reps: { compound: { min: 6, max: 10 }, isolation: { min: 10, max: 15 } },
	restSeconds: { compound: 150, isolation: 90 },
	durationSeconds: 60,
};

// Hevy exercise types whose sets are a duration rather than reps.
const TIMED_TYPES = new Set([
	"duration",
	"weight_duration",
	"distance_duration",
	"floors_duration",
	"steps_duration",
]);

export const isTimed = (exercise: Exercise | undefined) =>
	Boolean(exercise?.type && TIMED_TYPES.has(exercise.type));

export interface ExerciseTargets {
	reps: RepRange | null;
	durationSeconds: number | null;
	restSeconds: number;
}

/** An exercise's targets: its own where set, otherwise the user's defaults. */
export function resolveTargets(
	routineExercise: RoutineExercise,
	exercise: Exercise | undefined,
	defaults: TrainingDefaults
): ExerciseTargets {
	const kind = exercise?.compound ? "compound" : "isolation";
	const timed = isTimed(exercise);
	return {
		reps: timed ? null : routineExercise.reps ?? defaults.reps[kind],
		durationSeconds: timed
			? routineExercise.durationSeconds ?? defaults.durationSeconds
			: null,
		restSeconds: routineExercise.restSeconds ?? defaults.restSeconds[kind],
	};
}

export function formatRest(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return m === 0 ? `${s}s` : `${m}:${String(s).padStart(2, "0")}`;
}

export const formatReps = (reps: RepRange) =>
	reps.min === reps.max ? `${reps.min}` : `${reps.min}–${reps.max}`;

function median(values: number[]): number | undefined {
	if (values.length === 0) return undefined;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)];
}

function percentile(values: number[], p: number): number {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

// Fewer samples than this and we keep the existing default.
const MIN_SAMPLES = 5;

/**
 * Suggests rest and rep defaults from the user's existing Hevy routines:
 * the median rest, and the middle half of rep targets, for compound and
 * isolation exercises separately.
 */
export function inferDefaultsFromRoutines(
	routines: HevyRoutine[],
	getExercise: (id: string) => Exercise | undefined,
	current: TrainingDefaults
): TrainingDefaults {
	const rest = { compound: [] as number[], isolation: [] as number[] };
	const reps = { compound: [] as number[], isolation: [] as number[] };

	for (const routine of routines) {
		for (const ex of routine.exercises) {
			const exercise = getExercise(ex.exercise_template_id);
			if (!exercise || isTimed(exercise)) continue;
			const kind = exercise.compound ? "compound" : "isolation";
			// 0 usually means a superset partner, not a real rest time.
			if (ex.rest_seconds) rest[kind].push(ex.rest_seconds);
			for (const set of ex.sets) {
				if (set.type !== "normal") continue;
				if (set.rep_range) reps[kind].push(set.rep_range.start, set.rep_range.end);
				else if (set.reps) reps[kind].push(set.reps);
			}
		}
	}

	const inferRest = (kind: "compound" | "isolation") =>
		rest[kind].length >= MIN_SAMPLES ? median(rest[kind])! : current.restSeconds[kind];
	const inferReps = (kind: "compound" | "isolation"): RepRange =>
		reps[kind].length >= MIN_SAMPLES
			? { min: percentile(reps[kind], 0.25), max: percentile(reps[kind], 0.75) }
			: current.reps[kind];

	return {
		...current,
		restSeconds: { compound: inferRest("compound"), isolation: inferRest("isolation") },
		reps: { compound: inferReps("compound"), isolation: inferReps("isolation") },
	};
}
