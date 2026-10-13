import { resolveTargets } from "../training-defaults";
import type {
	Exercise,
	HevyLink,
	Routine,
	TrainingDefaults,
	WorkoutDay,
} from "../types";
import type { HevyClient, HevyRoutineInput, HevyRoutineSet } from "./client";

type GetExercise = (id: string) => Exercise | undefined;

/** One Hevy routine for one training day. Weights are left blank for the user to fill in Hevy. */
export function buildDayRoutine(
	day: WorkoutDay,
	getExercise: GetExercise,
	defaults: TrainingDefaults
): HevyRoutineInput {
	return {
		title: day.name,
		notes: null,
		exercises: day.exercises.map((routineExercise) => {
			const targets = resolveTargets(
				routineExercise,
				getExercise(routineExercise.exerciseId),
				defaults
			);
			const reps = targets.reps;
			const set: HevyRoutineSet = {
				type: "normal",
				weight_kg: null,
				reps: reps && reps.min === reps.max ? reps.min : null,
				distance_meters: null,
				duration_seconds: targets.durationSeconds,
			};
			// Hevy's update endpoint rejects rep_range: null, so leave it out instead.
			if (reps && reps.min !== reps.max) set.rep_range = { start: reps.min, end: reps.max };
			return {
				exercise_template_id: routineExercise.exerciseId,
				superset_id: null,
				rest_seconds: targets.restSeconds,
				notes: routineExercise.notes?.trim() || null,
				sets: Array.from({ length: routineExercise.sets }, () => ({ ...set })),
			};
		}),
	};
}

/** Exercise IDs in the routine that the Hevy account does not have. */
export function findUnresolvedExercises(
	routine: Routine,
	hevyExerciseIds: Set<string>
): string[] {
	const ids = routine.days.flatMap((day) => day.exercises.map((ex) => ex.exerciseId));
	return [...new Set(ids)].filter((id) => !hevyExerciseIds.has(id));
}

/** Points every use of one exercise at another, e.g. a legacy exercise at a Hevy custom. */
export function replaceExercise(routine: Routine, fromId: string, toId: string): Routine {
	return {
		...routine,
		days: routine.days.map((day) => ({
			...day,
			exercises: day.exercises.map((ex) =>
				ex.exerciseId === fromId ? { ...ex, exerciseId: toId } : ex
			),
		})),
	};
}

export interface PushResult {
	link: HevyLink;
	created: string[];
	updated: string[];
	/** Days with no exercises, which Hevy cannot store. */
	skipped: string[];
	/** Hevy routines for days since removed from the app; the API cannot delete them. */
	orphanedRoutineIds: string[];
	folderCreated: boolean;
}

/**
 * Pushes a routine to Hevy as a folder with one Hevy routine per day.
 * Days pushed before are updated in place. onLink is called after every
 * successful write so a failure part-way through never leaves duplicates
 * on the next attempt.
 */
export async function pushRoutine(
	client: HevyClient,
	routine: Routine,
	getExercise: GetExercise,
	defaults: TrainingDefaults,
	onLink: (link: HevyLink) => void
): Promise<PushResult> {
	const previous = routine.hevy;
	const result: PushResult = {
		link: {
			folderId: previous?.folderId ?? null,
			dayRoutineIds: { ...previous?.dayRoutineIds },
			pushedAt: new Date().toISOString(),
		},
		created: [],
		updated: [],
		skipped: [],
		orphanedRoutineIds: [],
		folderCreated: false,
	};
	const save = () => onLink({ ...result.link, dayRoutineIds: { ...result.link.dayRoutineIds } });

	const existingFolder =
		result.link.folderId !== null ? await client.getRoutineFolder(result.link.folderId) : null;
	if (!existingFolder) {
		const folder = await client.createRoutineFolder(routine.name);
		result.link.folderId = folder.id;
		result.folderCreated = true;
		save();
	}

	for (const day of routine.days) {
		if (day.exercises.length === 0) {
			result.skipped.push(day.name);
			continue;
		}
		const body = buildDayRoutine(day, getExercise, defaults);
		const existingId = result.link.dayRoutineIds[day.id];
		const updated = existingId
			? await client.updateRoutine(existingId, body, result.link.folderId)
			: null;
		if (updated) {
			result.updated.push(day.name);
		} else {
			const created = await client.createRoutine(body, result.link.folderId);
			result.link.dayRoutineIds[day.id] = created.id;
			result.created.push(day.name);
		}
		save();
	}

	const dayIds = new Set(routine.days.map((day) => day.id));
	for (const [dayId, hevyId] of Object.entries(result.link.dayRoutineIds)) {
		if (!dayIds.has(dayId)) {
			result.orphanedRoutineIds.push(hevyId);
			delete result.link.dayRoutineIds[dayId];
		}
	}
	save();

	return result;
}
