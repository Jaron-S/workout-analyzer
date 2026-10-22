import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ClaudeDraft, ClaudeUndo } from "../claude-sync";
import { APP_MODEL } from "../coach/agent";
import { analyzeRoutine, coachToolSchemas, describePreferences, describeRoutine, runCoachTool, type CoachContext } from "../coach/tools";
import { buildCatalog } from "../exercise-catalog";
import { diffRoutine } from "../routine-diff";
import type { ExercisePreferences, MuscleOverrides, PriorityTier, Routine, TrainingDefaults } from "../types";

// The Setsmith connector for claude.ai and the Claude apps. Claude edits a
// draft of the routine open in the app, using the same tools as the in-app
// coach; the draft lives in the user's account, so it also shows in the app
// for review. Applying takes the user's explicit agreement in the chat.

/** What the server needs from the user's data (UserStore in production). */
export interface ConnectorStore {
	currentRoutine(): Promise<Routine | null>;
	listRoutines(): Promise<(Routine & { updatedAt?: string })[]>;
	getRoutine(id: string): Promise<Routine | null>;
	setCurrentRoutine(id: string): Promise<void>;
	saveRoutine(routine: Routine): Promise<void>;
	priorities(): Promise<Partial<Record<PriorityTier, string[]>>>;
	trainingDefaults(): Promise<TrainingDefaults>;
	muscleOverrides(): Promise<MuscleOverrides>;
	exercisePreferences(): Promise<ExercisePreferences>;
	saveExercisePreferences(preferences: ExercisePreferences): Promise<void>;
	draft(): Promise<ClaudeDraft | null>;
	saveDraft(draft: ClaudeDraft): Promise<void>;
	clearDraft(): Promise<void>;
	undo(): Promise<ClaudeUndo | null>;
	saveUndo(undo: ClaudeUndo): Promise<void>;
	clearUndo(): Promise<void>;
}

const INSTRUCTIONS = `Setsmith is the user's hypertrophy training planner. You can read their current routine and its analysis, and change it.

${APP_MODEL}

How to work:
- Start with get_routine to see the routine open in Setsmith, the user's settings, and any changes already waiting.
- Edits apply to the routine open in Setsmith. To work on another saved routine, use list_routines then switch_routine; to start a new one, create_routine. Both open that routine in the app too. Only switch or create when the user asks or clearly wants a separate routine, and apply or discard waiting changes first.
- Find exercise ids with search_exercises; never guess one. Leave reps and rest at the user's defaults unless an exercise genuinely needs different ones.
- Edits collect in a draft. Make the changes you recommend, then run analyze_routine and adjust if volume or session fatigue is off for the user's priorities.
- Then show the user the change list (get_routine includes it) and ask whether to apply it. Call apply_changes only after they clearly agree, never in the same turn as you first show the changes, and never describe the changes as done before it succeeds. They can also review and apply the draft in the Setsmith app, where it appears automatically.
- discard_changes throws the draft away; undo_last_change reverses the last applied change.
- Exercises only in the user's Hevy account (custom exercises) show by id; leave them as they are.`;

const READ_ONLY = new Set(["search_exercises", "analyze_routine", "exercise_rankings", "exercise_details"]);

const text = (t: string, isError = false): CallToolResult => ({ content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) });

const CONNECTOR_TOOLS = [
	{
		name: "get_routine",
		description:
			"The routine open in Setsmith (or the draft, if changes are waiting), the user's training defaults, priority tiers and exercise preferences, and the list of waiting changes.",
		inputSchema: { type: "object" as const, properties: {} },
		annotations: { readOnlyHint: true },
	},
	{
		name: "list_routines",
		description: "All routines saved in the user's account, newest first. Edits always apply to the routine open in Setsmith.",
		inputSchema: { type: "object" as const, properties: {} },
		annotations: { readOnlyHint: true },
	},
	{
		name: "create_routine",
		description:
			"Starts a new, empty routine with the given name and day names, saves it to the user's account and opens it in Setsmith, so the following edits build it. The routine that was open stays saved.",
		inputSchema: {
			type: "object" as const,
			properties: {
				name: { type: "string", minLength: 1, maxLength: 80 },
				day_names: {
					type: "array",
					items: { type: "string", minLength: 1, maxLength: 60 },
					minItems: 1,
					maxItems: 7,
					description: 'One per training day, e.g. ["Upper A", "Lower A", "Upper B", "Lower B"]. Default: Day 1 to Day 3.',
				},
			},
			required: ["name"],
		},
	},
	{
		name: "switch_routine",
		description: "Opens another saved routine (id from list_routines) in Setsmith, so the following edits apply to it.",
		inputSchema: {
			type: "object" as const,
			properties: { routine_id: { type: "string" } },
			required: ["routine_id"],
		},
	},
	{
		name: "apply_changes",
		description: "Applies the waiting draft to the routine. Only after the user has agreed to the listed changes.",
		inputSchema: { type: "object" as const, properties: {} },
		annotations: { destructiveHint: false },
	},
	{
		name: "discard_changes",
		description: "Throws away the waiting draft.",
		inputSchema: { type: "object" as const, properties: {} },
	},
	{
		name: "undo_last_change",
		description: "Restores the routine as it was before the last apply_changes.",
		inputSchema: { type: "object" as const, properties: {} },
	},
];

export function createSetsmithServer(store: ConnectorStore): Server {
	const server = new Server(
		{ name: "setsmith", title: "Setsmith", version: "1.0.0" },
		{ capabilities: { tools: {} }, instructions: INSTRUCTIONS }
	);

	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: [
			...CONNECTOR_TOOLS,
			...coachToolSchemas()
				// get_routine above replaces the coach's version.
				.filter((t) => t.name !== "get_routine")
				.map((t) => ({
					name: t.name,
					description: t.description,
					inputSchema: t.inputSchema as { type: "object" },
					annotations: READ_ONLY.has(t.name) ? { readOnlyHint: true } : undefined,
				})),
		],
	}));

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name, arguments: args = {} } = request.params;
		try {
			return await callTool(store, name, args);
		} catch (error) {
			return text(`Setsmith couldn't do that: ${error instanceof Error ? error.message : String(error)}`, true);
		}
	});

	return server;
}

async function loadContext(store: ConnectorStore) {
	const [routine, draft, priorities, defaults, overrides, preferences] = await Promise.all([
		store.currentRoutine(),
		store.draft(),
		store.priorities(),
		store.trainingDefaults(),
		store.muscleOverrides(),
		store.exercisePreferences(),
	]);
	const exercises = buildCatalog(overrides);
	const byId = new Map(exercises.map((e) => [e.id, e]));
	const ctx: CoachContext = { exercises, getExercise: (id) => byId.get(id), defaults, priorities, preferences };
	// A draft for another routine is stale: the user has switched routines since.
	const liveDraft = draft && routine && draft.routineId === routine.id ? draft : null;
	return { routine, draft: liveDraft, ctx };
}

const NO_ROUTINE =
	"There's no routine in this Setsmith account yet. Ask the user to open Setsmith while signed in (routines save to the account automatically), then try again.";

async function callTool(store: ConnectorStore, name: string, args: Record<string, unknown>): Promise<CallToolResult> {
	const { routine, draft, ctx } = await loadContext(store);

	if (name === "list_routines") {
		const all = await store.listRoutines();
		if (all.length === 0) return text(NO_ROUTINE);
		return text(
			all
				.map(
					(r) =>
						`${r.id === routine?.id ? "* " : "  "}${r.name} [${r.id}]: ${r.days.length} days, ${r.days.reduce((n, d) => n + d.exercises.reduce((m, e) => m + e.sets, 0), 0)} sets${r.id === routine?.id ? " (open in Setsmith)" : ""}`
				)
				.join("\n")
		);
	}

	if (name === "create_routine" || name === "switch_routine") {
		if (draft) {
			return text(
				`"${routine!.name}" has ${draft.changes.length} waiting change${draft.changes.length === 1 ? "" : "s"}. Ask the user whether to apply or discard them first.`,
				true
			);
		}
		let target: Routine | null;
		if (name === "create_routine") {
			const title = typeof args.name === "string" ? args.name.trim().slice(0, 80) : "";
			if (!title) return text("Give the routine a name.", true);
			const dayNames =
				Array.isArray(args.day_names) && args.day_names.length
					? args.day_names.slice(0, 7).map((d, i) => (typeof d === "string" && d.trim() ? d.trim().slice(0, 60) : `Day ${i + 1}`))
					: ["Day 1", "Day 2", "Day 3"];
			const stamp = Date.now().toString(36);
			target = {
				id: `routine-${stamp}`,
				name: title,
				days: dayNames.map((dayName, i) => ({ id: `day-${stamp}-${i}`, name: dayName, exercises: [] })),
			};
			await store.saveRoutine(target);
		} else {
			target = typeof args.routine_id === "string" ? await store.getRoutine(args.routine_id) : null;
			if (!target) return text("No saved routine has that id. Use list_routines to see them.", true);
		}
		await store.setCurrentRoutine(target.id);
		return text(
			`${name === "create_routine" ? "Created and opened" : "Opened"} "${target.name}" in Setsmith${routine && routine.id !== target.id ? `; "${routine.name}" stays saved` : ""}.\n\n${describeRoutine(target, ctx)}`
		);
	}

	if (!routine) return text(NO_ROUTINE);
	const working = draft?.routine ?? routine;

	switch (name) {
		case "get_routine": {
			const d = ctx.defaults;
			const tiers = Object.entries(ctx.priorities)
				.filter(([, m]) => m?.length)
				.map(([tier, m]) => `${tier}: ${m!.join(", ")}`);
			return text(
				[
					draft ? "Showing the draft (changes are waiting; see below)." : "No changes are waiting.",
					describeRoutine(working, ctx),
					"",
					`Defaults: compound ${d.reps.compound.min}-${d.reps.compound.max} reps, ${d.restSeconds.compound}s rest; isolation ${d.reps.isolation.min}-${d.reps.isolation.max} reps, ${d.restSeconds.isolation}s rest; timed ${d.durationSeconds}s per set. Weight unit: ${d.weightUnit}.`,
					`Priority tiers: ${tiers.length ? tiers.join("; ") : "not set"}.`,
					describePreferences(ctx),
					...(draft ? ["", `Waiting changes (${draft.changes.length}):`, ...draft.changes.map((c) => `- ${c}`)] : []),
				].join("\n")
			);
		}
		case "analyze_routine":
			return text(analyzeRoutine(working, ctx));
		case "apply_changes": {
			if (!draft) return text("There are no waiting changes to apply.", true);
			await store.saveUndo({ routineId: routine.id, routine });
			await store.saveRoutine(draft.routine);
			await store.clearDraft();
			return text(
				`Applied ${draft.changes.length} change${draft.changes.length === 1 ? "" : "s"} to "${draft.routine.name}". Setsmith shows them now; undo_last_change reverses them.`
			);
		}
		case "discard_changes": {
			if (!draft) return text("There were no waiting changes.");
			await store.clearDraft();
			return text(`Discarded ${draft.changes.length} waiting change${draft.changes.length === 1 ? "" : "s"}.`);
		}
		case "undo_last_change": {
			const undo = await store.undo();
			if (!undo || undo.routineId !== routine.id) return text("There's no applied change to undo for this routine.", true);
			await store.saveRoutine(undo.routine);
			await store.clearUndo();
			if (draft) await store.clearDraft();
			return text(`Restored "${undo.routine.name}" to how it was before the last applied change.`);
		}
	}

	// The coach's tools: read-only ones see the draft; edits extend it.
	const outcome = runCoachTool(name, args, working, ctx);
	if (outcome.preferences && !outcome.isError) {
		await store.saveExercisePreferences(outcome.preferences);
		return text(outcome.result);
	}
	if (outcome.isError || !outcome.change) return text(outcome.result, outcome.isError);
	const next: ClaudeDraft = {
		routineId: routine.id,
		routine: outcome.routine,
		changes: [...(draft?.changes ?? []), outcome.change],
	};
	await store.saveDraft(next);
	const pending = diffRoutine(routine, outcome.routine).count;
	return text(`${outcome.result}\n\n(Draft: ${next.changes.length} change${next.changes.length === 1 ? "" : "s"} waiting${pending === 0 ? ", though the routine now matches the original" : ""}.)`);
}
