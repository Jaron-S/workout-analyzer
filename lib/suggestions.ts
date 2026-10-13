// Suggestions for muscles that are short of what their priority tier calls
// for: a few exercises that train them directly, and the day to add them to.

import { TIER_ORDER } from "./design";
import { STAPLES } from "./staples";

export { STAPLES };
import type { PriorityResult } from "./priority-analysis";
import type { Exercise, Routine } from "./types";

export interface Suggestion {
	muscle: string;
	result: PriorityResult;
	/** Whole sets to add, capped so one suggestion stays one exercise. */
	sets: number;
	exercises: Exercise[];
	/** The day the exercise fits best. */
	dayId: string | null;
}

const MAX_SETS_PER_SUGGESTION = 4;
const SUGGESTED_TIERS = new Set(["S", "A", "B"]);

// Loaded equipment first: easier to progress for hypertrophy than bodyweight.
const EQUIPMENT_RANK: Record<string, number> = { machine: 0, dumbbell: 0, barbell: 1, plate: 2, kettlebell: 2, resistance_band: 3 };

/** Exercises whose main muscle this is: staples, then the user's own, then the rest. */
export function exercisesFor(muscle: string, exercises: Exercise[], exclude: Set<string>): Exercise[] {
	const staples = STAPLES[muscle] ?? [];
	const rank = (e: Exercise) => {
		const staple = staples.indexOf(e.id);
		if (staple !== -1) return staple;
		if (e.hevyCustom) return 100;
		return 200 + (EQUIPMENT_RANK[e.equipment ?? ""] ?? 5) * 10 + (e.type === "weight_reps" ? 0 : 5);
	};
	return exercises
		.filter(
			(e) =>
				!e.legacy &&
				!exclude.has(e.id) &&
				e.muscle_weightings[0]?.muscle === muscle &&
				e.muscle_weightings[0].weighting === 1
		)
		.sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length || a.name.localeCompare(b.name));
}

/**
 * The day to add work for a muscle: one that doesn't train it yet (more
 * frequency helps), else the lightest day. Null when there are no days.
 */
export function bestDayFor(muscle: string, routine: Routine, getExercise: (id: string) => Exercise | undefined): string | null {
	if (routine.days.length === 0) return null;
	const load = routine.days.map((day) => ({
		id: day.id,
		sets: day.exercises.reduce((n, ex) => n + ex.sets, 0),
		trains: day.exercises.some((ex) =>
			getExercise(ex.exerciseId)?.muscle_weightings.some((w) => w.muscle === muscle && w.weighting >= 0.5)
		),
	}));
	const pool = load.filter((d) => !d.trains && d.sets > 0);
	const candidates = pool.length ? pool : load;
	return candidates.reduce((best, d) => (d.sets < best.sets ? d : best)).id;
}

export function buildSuggestions(
	results: PriorityResult[],
	routine: Routine,
	exercises: Exercise[],
	getExercise: (id: string) => Exercise | undefined,
	perMuscle = 3
): Suggestion[] {
	const inRoutine = new Set(routine.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)));
	return results
		.filter((r) => SUGGESTED_TIERS.has(r.tier) && r.setsToTarget >= 1)
		.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || b.setsToTarget - a.setsToTarget)
		.map((result) => ({
			muscle: result.muscle,
			result,
			sets: Math.min(MAX_SETS_PER_SUGGESTION, Math.max(2, Math.round(result.setsToTarget))),
			exercises: exercisesFor(result.muscle, exercises, inRoutine).slice(0, perMuscle),
			dayId: bestDayFor(result.muscle, routine, getExercise),
		}))
		.filter((s) => s.exercises.length > 0);
}
