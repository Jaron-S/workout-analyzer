// Tools Claude uses to read and edit a routine. Each tool is a pure function
// from (input, routine) to a new routine plus a text result, with no React or
// SDK dependency, so the same tools can back the in-app chat and, later, an
// MCP server.

import { z } from "zod/v4";
import volumeLandmarks from "@/data/volume-landmarks.json";
import { ALL_MUSCLES, MAX_MUSCLE_SETS_PER_SESSION, MAX_SETS_PER_SESSION } from "../constants";
import { HEVY_EQUIPMENT } from "../hevy/exercises";
import { searchExercises } from "../search";
import { formatReps, formatRest, resolveTargets } from "../training-defaults";
import type {
	Exercise,
	PriorityTier,
	Routine,
	RoutineExercise,
	TrainingDefaults,
	VolumeLandmarks,
	WorkoutDay,
} from "../types";
import { calculateMuscleVolumes, getVolumeZone } from "../volume-calculator";

export interface CoachContext {
	exercises: Exercise[];
	getExercise: (id: string) => Exercise | undefined;
	defaults: TrainingDefaults;
	priorities: Partial<Record<PriorityTier, string[]>>;
}

export interface ToolOutcome {
	routine: Routine;
	result: string;
	/** A one-line description of the edit, for the review list. Absent for read-only tools. */
	change?: string;
	isError?: boolean;
}

interface CoachTool<S extends z.ZodType> {
	name: string;
	description: string;
	schema: S;
	run: (input: z.infer<S>, routine: Routine, ctx: CoachContext) => ToolOutcome;
}

const defineTool = <S extends z.ZodType>(tool: CoachTool<S>) => tool;

const MAX_SETS = 10;

class ToolError extends Error {}

const findDay = (routine: Routine, dayId: string): WorkoutDay => {
	const day = routine.days.find((d) => d.id === dayId);
	if (!day) {
		throw new ToolError(
			`No day with id "${dayId}". Day ids: ${routine.days.map((d) => d.id).join(", ") || "none"}.`
		);
	}
	return day;
};

const requireExercise = (ctx: CoachContext, id: string): Exercise => {
	const exercise = ctx.getExercise(id);
	if (!exercise || exercise.legacy) {
		throw new ToolError(`No exercise with id "${id}". Use search_exercises to find ids.`);
	}
	return exercise;
};

const requireIndex = (day: WorkoutDay, index: number) => {
	if (index < 0 || index >= day.exercises.length) {
		throw new ToolError(
			`"${day.name}" has ${day.exercises.length} exercises; index ${index} is out of range.`
		);
	}
};

const withDay = (routine: Routine, dayId: string, update: (day: WorkoutDay) => WorkoutDay): Routine => ({
	...routine,
	days: routine.days.map((d) => (d.id === dayId ? update(d) : d)),
});

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const nameOf = (ctx: CoachContext, id: string) => ctx.getExercise(id)?.name ?? id;

/** Drops keys set to undefined (Firestore rejects them). */
const compact = <T extends object>(value: T): T =>
	Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

function describeExercise(ex: RoutineExercise, index: number, ctx: CoachContext): string {
	const exercise = ctx.getExercise(ex.exerciseId);
	const targets = resolveTargets(ex, exercise, ctx.defaults);
	const work = targets.reps ? `${formatReps(targets.reps)} reps` : `${targets.durationSeconds}s`;
	const own = ex.reps || ex.restSeconds !== undefined || ex.durationSeconds !== undefined;
	const flags = [
		exercise?.legacy ? "not linked to Hevy" : "",
		own ? "custom targets" : "default targets",
	].filter(Boolean);
	return `  ${index}. ${nameOf(ctx, ex.exerciseId)} [${ex.exerciseId}]: ${ex.sets} × ${work}, ${formatRest(
		targets.restSeconds
	)} rest (${flags.join(", ")})${ex.notes ? `; notes: ${ex.notes}` : ""}`;
}

export function describeDay(day: WorkoutDay, ctx: CoachContext): string {
	const sets = day.exercises.reduce((n, ex) => n + ex.sets, 0);
	const lines = day.exercises.map((ex, i) => describeExercise(ex, i, ctx));
	return [`Day "${day.name}" [${day.id}], ${sets} sets:`, ...(lines.length ? lines : ["  (no exercises)"])].join(
		"\n"
	);
}

/** The routine as compact text: day ids, and exercises by 0-based index. */
export function describeRoutine(routine: Routine, ctx: CoachContext): string {
	return [
		`Routine "${routine.name}", ${routine.days.length} days per week.`,
		...routine.days.map((d) => describeDay(d, ctx)),
	].join("\n");
}

const LANDMARKS = volumeLandmarks as VolumeLandmarks;
const ZONE_LABELS: Record<ReturnType<typeof getVolumeZone>, string> = {
	"below-mv": "below maintenance (MV)",
	"mv-mev": "maintenance, below MEV",
	"mev-mav": "growing, below MAV",
	mav: "in the MAV sweet spot",
	"mav-mrv": "above MAV, approaching MRV",
	"above-mrv": "above MRV",
};

/** Weekly volume per muscle against its landmarks and the user's priority tier. */
export function analyzeRoutine(routine: Routine, ctx: CoachContext): string {
	const tierOf = (muscle: string) =>
		(Object.entries(ctx.priorities).find(([, muscles]) => muscles?.includes(muscle))?.[0] as
			| PriorityTier
			| undefined) ?? "unranked";
	const volumes = calculateMuscleVolumes(routine, ctx.exercises);
	const muscleLines = ALL_MUSCLES.map((muscle) => {
		const v = volumes.find((mv) => mv.muscle === muscle);
		const sets = v?.totalSets ?? 0;
		const l = LANDMARKS[muscle];
		return `  ${muscle} (tier ${tierOf(muscle)}): ${sets.toFixed(1)} sets/week over ${
			v?.frequency ?? 0
		} sessions, ${ZONE_LABELS[getVolumeZone(sets, LANDMARKS, muscle)]} [MV ${l.mv}, MEV ${l.mev}, MAV ${
			l.mav_min
		}-${l.mav_max}, MRV ${l.mrv}]`;
	});
	const sessionLines = routine.days.map((day) => {
		const total = day.exercises.reduce((n, ex) => n + ex.sets, 0);
		const perMuscle = new Map<string, number>();
		for (const ex of day.exercises) {
			for (const w of ctx.getExercise(ex.exerciseId)?.muscle_weightings ?? []) {
				perMuscle.set(w.muscle, (perMuscle.get(w.muscle) ?? 0) + ex.sets * w.weighting);
			}
		}
		const junk = [...perMuscle].filter(([, s]) => s > MAX_MUSCLE_SETS_PER_SESSION);
		return `  ${day.name}: ${total} sets${total > MAX_SETS_PER_SESSION ? " (very high fatigue)" : ""}${
			junk.length ? `; junk-volume risk for ${junk.map(([m, s]) => `${m} ${s.toFixed(1)}`).join(", ")}` : ""
		}`;
	});
	return [
		"Weekly volume (sets are weighted: a set counts fully for its main muscle and partly for others):",
		...muscleLines,
		`Sessions (above ${MAX_SETS_PER_SESSION} sets is very fatiguing; above ${MAX_MUSCLE_SETS_PER_SESSION} sets for one muscle in a session risks junk volume):`,
		...sessionLines,
	].join("\n");
}

const targetFields = {
	reps_min: z.number().int().min(1).max(100).optional().describe("Lower end of the rep range."),
	reps_max: z
		.number()
		.int()
		.min(1)
		.max(100)
		.optional()
		.describe("Upper end of the rep range; equal to reps_min for a single target."),
	rest_seconds: z.number().int().min(0).max(900).optional(),
	duration_seconds: z
		.number()
		.int()
		.min(5)
		.max(3600)
		.optional()
		.describe("Seconds per set, only for timed exercises such as planks."),
	notes: z.string().max(300).optional().describe("Short cues shown in Hevy. Empty string clears."),
};

function applyTargets(
	ex: RoutineExercise,
	input: {
		reps_min?: number;
		reps_max?: number;
		rest_seconds?: number;
		duration_seconds?: number;
		notes?: string;
	}
): RoutineExercise {
	const next = { ...ex };
	if (input.reps_min !== undefined || input.reps_max !== undefined) {
		const min = input.reps_min ?? input.reps_max!;
		const max = input.reps_max ?? input.reps_min!;
		next.reps = { min: Math.min(min, max), max: Math.max(min, max) };
	}
	if (input.rest_seconds !== undefined) next.restSeconds = input.rest_seconds;
	if (input.duration_seconds !== undefined) next.durationSeconds = input.duration_seconds;
	if (input.notes !== undefined) next.notes = input.notes.trim() || undefined;
	return compact(next);
}

let dayCounter = 0;
const newDayId = () => `day-${Date.now().toString(36)}-${(dayCounter++).toString(36)}`;

export const COACH_TOOLS = [
	defineTool({
		name: "search_exercises",
		description:
			"Search the exercise library (Hevy's exercises plus the user's own custom ones). Returns ids to use with add_exercise and update_exercise, with each exercise's muscle weightings. Search by name words, main muscle, equipment, or a combination.",
		schema: z.object({
			query: z.string().optional().describe('Words in the name, e.g. "incline press" or "curl".'),
			muscle: z.enum(ALL_MUSCLES).optional().describe("Only exercises whose main muscle is this."),
			equipment: z.enum(HEVY_EQUIPMENT).optional().describe('"none" means bodyweight.'),
			limit: z.number().int().min(1).max(40).optional().describe("Default 15."),
		}),
		run: (input, routine, ctx) => {
			const matches = searchExercises(ctx.exercises, input.query ?? "").filter(
				(e) =>
					!e.legacy &&
					(!input.muscle || e.muscle_weightings[0]?.muscle === input.muscle) &&
					(!input.equipment || e.equipment === input.equipment)
			);
			const shown = matches.slice(0, input.limit ?? 15);
			const lines = shown.map((e) => {
				const muscles = e.muscle_weightings
					.map((w) => `${w.muscle} ${Math.round(w.weighting * 100)}%`)
					.join(", ");
				const tags = [
					e.equipment === "none" ? "bodyweight" : e.equipment,
					e.compound ? "compound" : "isolation",
					e.type && e.type !== "weight_reps" ? e.type : "",
					e.hevyCustom ? "user's custom" : "",
				].filter(Boolean);
				return `${e.id} | ${e.name} | ${tags.join(", ")} | ${muscles || "no muscle volume"}`;
			});
			return {
				routine,
				result: shown.length
					? `${matches.length} matches${matches.length > shown.length ? `, showing ${shown.length}` : ""}:\n${lines.join("\n")}`
					: "No matches. Try fewer or different words, or drop a filter.",
			};
		},
	}),
	defineTool({
		name: "get_routine",
		description: "The current draft routine: day ids, and each day's exercises by 0-based index.",
		schema: z.object({}),
		run: (_input, routine, ctx) => ({ routine, result: describeRoutine(routine, ctx) }),
	}),
	defineTool({
		name: "analyze_routine",
		description:
			"The app's analysis of the current draft: weekly volume per muscle against its landmarks (MV, MEV, MAV, MRV) and the user's priority tier, plus per-session fatigue. Check it after making changes.",
		schema: z.object({}),
		run: (_input, routine, ctx) => ({ routine, result: analyzeRoutine(routine, ctx) }),
	}),
	defineTool({
		name: "set_routine_name",
		description: "Rename the routine. In Hevy it becomes the folder name.",
		schema: z.object({ name: z.string().min(1).max(80) }),
		run: (input, routine) => ({
			routine: { ...routine, name: input.name },
			result: `Routine renamed to "${input.name}".`,
			change: `Renamed the routine to "${input.name}"`,
		}),
	}),
	defineTool({
		name: "add_day",
		description: "Add a training day. Returns its day_id.",
		schema: z.object({
			name: z.string().min(1).max(60),
			position: z.number().int().min(0).optional().describe("0-based; default is last."),
		}),
		run: (input, routine) => {
			const day: WorkoutDay = { id: newDayId(), name: input.name, exercises: [] };
			const days = [...routine.days];
			days.splice(clamp(input.position ?? days.length, 0, days.length), 0, day);
			return {
				routine: { ...routine, days },
				result: `Added "${day.name}" with day_id ${day.id}.`,
				change: `Added day "${day.name}"`,
			};
		},
	}),
	defineTool({
		name: "update_day",
		description: "Rename a day and/or move it to another position.",
		schema: z.object({
			day_id: z.string(),
			name: z.string().min(1).max(60).optional(),
			position: z.number().int().min(0).optional().describe("New 0-based position."),
		}),
		run: (input, routine) => {
			const day = findDay(routine, input.day_id);
			const updated = { ...day, name: input.name ?? day.name };
			const days = routine.days.filter((d) => d.id !== day.id);
			const at = input.position ?? routine.days.indexOf(day);
			days.splice(clamp(at, 0, days.length), 0, updated);
			const what = [
				input.name && input.name !== day.name ? `renamed "${day.name}" to "${input.name}"` : "",
				input.position !== undefined ? `moved "${updated.name}" to position ${at + 1}` : "",
			].filter(Boolean);
			return {
				routine: { ...routine, days },
				result: what.length ? `Done: ${what.join(", ")}.` : "Nothing changed.",
				change: what.length ? what.join(", ").replace(/^./, (c) => c.toUpperCase()) : undefined,
			};
		},
	}),
	defineTool({
		name: "remove_day",
		description: "Remove a training day and all its exercises.",
		schema: z.object({ day_id: z.string() }),
		run: (input, routine) => {
			const day = findDay(routine, input.day_id);
			return {
				routine: { ...routine, days: routine.days.filter((d) => d.id !== day.id) },
				result: `Removed "${day.name}".`,
				change: `Removed day "${day.name}"`,
			};
		},
	}),
	defineTool({
		name: "add_exercise",
		description:
			"Add an exercise to a day. Leave reps and rest out to use the user's defaults; set them only when this exercise should differ.",
		schema: z.object({
			day_id: z.string(),
			exercise_id: z.string().describe("From search_exercises."),
			sets: z.number().int().min(1).max(MAX_SETS),
			position: z.number().int().min(0).optional().describe("0-based; default is last."),
			...targetFields,
		}),
		run: (input, routine, ctx) => {
			const day = findDay(routine, input.day_id);
			const exercise = requireExercise(ctx, input.exercise_id);
			const added = applyTargets({ exerciseId: exercise.id, sets: input.sets }, input);
			const exercises = [...day.exercises];
			exercises.splice(clamp(input.position ?? exercises.length, 0, exercises.length), 0, added);
			const next = withDay(routine, day.id, (d) => ({ ...d, exercises }));
			return {
				routine: next,
				result: describeDay(findDay(next, day.id), ctx),
				change: `Added ${exercise.name} (${input.sets} sets) to ${day.name}`,
			};
		},
	}),
	defineTool({
		name: "update_exercise",
		description:
			"Change an exercise in a day: swap it for another exercise (keeping sets and targets), or change its sets, reps, rest, duration or notes. use_defaults clears its own reps, rest and duration first.",
		schema: z.object({
			day_id: z.string(),
			index: z.number().int().min(0).describe("0-based position in the day."),
			exercise_id: z.string().optional().describe("Swap to this exercise."),
			sets: z.number().int().min(1).max(MAX_SETS).optional(),
			use_defaults: z.boolean().optional(),
			...targetFields,
		}),
		run: (input, routine, ctx) => {
			const day = findDay(routine, input.day_id);
			requireIndex(day, input.index);
			const before = day.exercises[input.index];
			let updated: RoutineExercise = { ...before };
			if (input.exercise_id) updated.exerciseId = requireExercise(ctx, input.exercise_id).id;
			if (input.sets !== undefined) updated.sets = input.sets;
			if (input.use_defaults) {
				const { reps: _r, restSeconds: _s, durationSeconds: _d, ...rest } = updated;
				updated = rest;
			}
			updated = applyTargets(updated, input);
			const next = withDay(routine, day.id, (d) => ({
				...d,
				exercises: d.exercises.map((ex, i) => (i === input.index ? updated : ex)),
			}));
			const name = nameOf(ctx, before.exerciseId);
			return {
				routine: next,
				result: describeDay(findDay(next, day.id), ctx),
				change:
					updated.exerciseId !== before.exerciseId
						? `Swapped ${name} for ${nameOf(ctx, updated.exerciseId)} in ${day.name}`
						: `Changed ${name} in ${day.name}`,
			};
		},
	}),
	defineTool({
		name: "remove_exercise",
		description: "Remove an exercise from a day.",
		schema: z.object({ day_id: z.string(), index: z.number().int().min(0) }),
		run: (input, routine, ctx) => {
			const day = findDay(routine, input.day_id);
			requireIndex(day, input.index);
			const name = nameOf(ctx, day.exercises[input.index].exerciseId);
			const next = withDay(routine, day.id, (d) => ({
				...d,
				exercises: d.exercises.filter((_, i) => i !== input.index),
			}));
			return {
				routine: next,
				result: describeDay(findDay(next, day.id), ctx),
				change: `Removed ${name} from ${day.name}`,
			};
		},
	}),
	defineTool({
		name: "move_exercise",
		description: "Move an exercise within a day or to another day.",
		schema: z.object({
			day_id: z.string(),
			index: z.number().int().min(0),
			to_day_id: z.string(),
			to_index: z.number().int().min(0).optional().describe("0-based; default is last."),
		}),
		run: (input, routine, ctx) => {
			const from = findDay(routine, input.day_id);
			requireIndex(from, input.index);
			const to = findDay(routine, input.to_day_id);
			const moved = from.exercises[input.index];
			let next = withDay(routine, from.id, (d) => ({
				...d,
				exercises: d.exercises.filter((_, i) => i !== input.index),
			}));
			next = withDay(next, to.id, (d) => {
				const exercises = [...d.exercises];
				exercises.splice(clamp(input.to_index ?? exercises.length, 0, exercises.length), 0, moved);
				return { ...d, exercises };
			});
			const name = nameOf(ctx, moved.exerciseId);
			return {
				routine: next,
				result: [findDay(next, from.id), ...(to.id === from.id ? [] : [findDay(next, to.id)])]
					.map((d) => describeDay(d, ctx))
					.join("\n"),
				change:
					from.id === to.id ? `Reordered ${name} in ${from.name}` : `Moved ${name} from ${from.name} to ${to.name}`,
			};
		},
	}),
];

export type CoachToolName = (typeof COACH_TOOLS)[number]["name"];

/** JSON Schemas for the tools, generated from the same Zod schemas that validate input. */
export function coachToolSchemas() {
	return COACH_TOOLS.map((tool) => {
		const { $schema: _ignored, ...inputSchema } = z.toJSONSchema(tool.schema) as Record<string, unknown>;
		return { name: tool.name, description: tool.description, inputSchema };
	});
}

/**
 * Validates and runs one tool call. Bad input or a bad reference returns an
 * error result for Claude to correct rather than throwing.
 */
export function runCoachTool(
	name: string,
	input: unknown,
	routine: Routine,
	ctx: CoachContext
): ToolOutcome {
	const tool = COACH_TOOLS.find((t) => t.name === name);
	if (!tool) return { routine, result: `Unknown tool "${name}".`, isError: true };
	const parsed = tool.schema.safeParse(input);
	if (!parsed.success) {
		return { routine, result: `Invalid input: ${z.prettifyError(parsed.error)}`, isError: true };
	}
	try {
		// The union of tools loses the pairing between schema and run.
		return (tool.run as (i: unknown, r: Routine, c: CoachContext) => ToolOutcome)(
			parsed.data,
			routine,
			ctx
		);
	} catch (error) {
		if (error instanceof ToolError) return { routine, result: error.message, isError: true };
		throw error;
	}
}
