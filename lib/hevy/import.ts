import type { HevyLink, Routine, RoutineExercise } from "../types";
import type { HevyRoutine } from "./client";

// Hevy routines in, a Setsmith routine out: each Hevy routine becomes a day.
// The result stays linked to those Hevy routines, so pushing it later updates
// them in place rather than creating copies.

function toExercise(ex: HevyRoutine["exercises"][number]): RoutineExercise {
	const working = ex.sets.filter((s) => s.type !== "warmup");
	const sets = working.length ? working : ex.sets;
	const first = sets[0];
	const out: RoutineExercise = { exerciseId: ex.exercise_template_id, sets: Math.min(10, Math.max(1, sets.length)) };
	if (first?.rep_range?.start && first.rep_range.end) {
		out.reps = { min: first.rep_range.start, max: first.rep_range.end };
	} else if (first?.reps) {
		out.reps = { min: first.reps, max: first.reps };
	}
	if (first?.duration_seconds) out.durationSeconds = first.duration_seconds;
	if (ex.rest_seconds) out.restSeconds = ex.rest_seconds;
	if (ex.notes?.trim()) out.notes = ex.notes.trim().slice(0, 300);
	return out;
}

export function routineFromHevy(name: string, routines: HevyRoutine[], folderId: number | null): Routine {
	const stamp = Date.now().toString(36);
	const days = routines.map((r, i) => ({
		id: `day-${stamp}-${i}`,
		name: r.title.slice(0, 60) || `Day ${i + 1}`,
		exercises: r.exercises.map(toExercise),
	}));
	const hevy: HevyLink = {
		folderId,
		dayRoutineIds: Object.fromEntries(days.map((d, i) => [d.id, routines[i].id])),
		pushedAt: new Date().toISOString(),
	};
	return { id: `hevy-${stamp}`, name: name.slice(0, 80) || "Imported routine", days, hevy };
}
