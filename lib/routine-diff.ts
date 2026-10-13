// What changed between the applied routine and a draft (Claude's changes),
// so the builder can mark added, changed and removed exercises in place.

import type { Routine, RoutineExercise, WorkoutDay } from "./types";

export type ExerciseChange = "added" | "changed";

export interface DayDiff {
	/** The day itself is new in the draft. */
	added: boolean;
	renamed: boolean;
	/** Change per exercise index in the draft day; unchanged ones are absent. */
	exercises: Map<number, ExerciseChange>;
	/** Exercises in the applied day that the draft no longer has. */
	removed: RoutineExercise[];
}

export interface RoutineDiff {
	days: Map<string, DayDiff>;
	removedDays: WorkoutDay[];
	renamed: boolean;
	count: number;
}

const sameTargets = (a: RoutineExercise, b: RoutineExercise) =>
	a.sets === b.sets &&
	a.reps?.min === b.reps?.min &&
	a.reps?.max === b.reps?.max &&
	a.restSeconds === b.restSeconds &&
	a.durationSeconds === b.durationSeconds &&
	(a.notes ?? "") === (b.notes ?? "");

export function diffRoutine(base: Routine, draft: Routine): RoutineDiff {
	const baseDays = new Map(base.days.map((d) => [d.id, d]));
	const days = new Map<string, DayDiff>();
	let count = 0;

	for (const day of draft.days) {
		const before = baseDays.get(day.id);
		const diff: DayDiff = {
			added: !before,
			renamed: Boolean(before && before.name !== day.name),
			exercises: new Map(),
			removed: [],
		};
		// Match each draft exercise to the first unused applied one with the
		// same exercise, so reordering alone doesn't count as a change.
		const unused = [...(before?.exercises ?? [])];
		day.exercises.forEach((ex, i) => {
			const j = unused.findIndex((b) => b.exerciseId === ex.exerciseId);
			if (j === -1) {
				diff.exercises.set(i, "added");
			} else {
				if (!sameTargets(unused[j], ex)) diff.exercises.set(i, "changed");
				unused.splice(j, 1);
			}
		});
		diff.removed = unused;
		count += diff.exercises.size + diff.removed.length + (diff.renamed ? 1 : 0) + (diff.added && day.exercises.length === 0 ? 1 : 0);
		days.set(day.id, diff);
	}

	const draftIds = new Set(draft.days.map((d) => d.id));
	const removedDays = base.days.filter((d) => !draftIds.has(d.id));
	const renamed = base.name !== draft.name;
	count += removedDays.length + (renamed ? 1 : 0);
	return { days, removedDays, renamed, count };
}
