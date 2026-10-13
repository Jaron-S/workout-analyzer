import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { buildCatalog } from "../exercise-catalog";
import { DEFAULT_TRAINING_DEFAULTS } from "../training-defaults";
import type { Routine } from "../types";
import { runCoachTurn } from "./agent";
import { coachToolSchemas, runCoachTool, type CoachContext } from "./tools";

const exercises = buildCatalog({});
const byId = new Map(exercises.map((e) => [e.id, e]));
const ctx: CoachContext = {
	exercises,
	getExercise: (id) => byId.get(id),
	defaults: DEFAULT_TRAINING_DEFAULTS,
	priorities: { S: ["Chest"], A: ["Side Delts"] },
};

const BENCH = "79D0BB3A";
const INCLINE_DB = "07B38369";
const LATERAL = "422B08F1";

const base = (): Routine => ({
	id: "r",
	name: "Test",
	days: [
		{ id: "d1", name: "Push", exercises: [{ exerciseId: BENCH, sets: 3 }] },
		{ id: "d2", name: "Pull", exercises: [] },
	],
});

const run = (name: string, input: unknown, routine = base()) => runCoachTool(name, input, routine, ctx);

describe("coach tools", () => {
	it("searches by name, main muscle and equipment, hiding legacy exercises", () => {
		const { result } = run("search_exercises", { query: "incline press", equipment: "dumbbell" });
		expect(result).toContain(`${INCLINE_DB} | Incline Bench Press (Dumbbell)`);
		expect(run("search_exercises", { query: "donkey calf" }).result).toMatch(/No matches/);
		const chest = run("search_exercises", { muscle: "Chest", limit: 40 }).result;
		expect(chest).not.toMatch(/Triceps Pushdown/);
	});

	it("adds days and exercises, with targets only when given", () => {
		const added = run("add_day", { name: "Legs" });
		const dayId = added.result.match(/day_id (\S+)\./)![1];
		expect(added.routine.days.map((d) => d.name)).toEqual(["Push", "Pull", "Legs"]);

		const withEx = runCoachTool(
			"add_exercise",
			{ day_id: dayId, exercise_id: LATERAL, sets: 4, reps_min: 15, reps_max: 20, notes: " slow " },
			added.routine,
			ctx
		);
		expect(withEx.change).toBe("Added Lateral Raise (Dumbbell) (4 sets) to Legs");
		expect(withEx.routine.days[2].exercises).toEqual([
			{ exerciseId: LATERAL, sets: 4, reps: { min: 15, max: 20 }, notes: "slow" },
		]);
	});

	it("swaps and edits exercises, and can restore the defaults", () => {
		const r = base();
		r.days[0].exercises[0] = { exerciseId: BENCH, sets: 3, reps: { min: 5, max: 5 }, restSeconds: 240 };
		const swapped = run("update_exercise", { day_id: "d1", index: 0, exercise_id: INCLINE_DB, sets: 4 }, r);
		expect(swapped.change).toBe("Swapped Bench Press (Barbell) for Incline Bench Press (Dumbbell) in Push");
		expect(swapped.routine.days[0].exercises[0]).toEqual({
			exerciseId: INCLINE_DB,
			sets: 4,
			reps: { min: 5, max: 5 },
			restSeconds: 240,
		});
		const reset = run("update_exercise", { day_id: "d1", index: 0, use_defaults: true }, swapped.routine);
		// No undefined keys: the routine goes to Firestore as-is.
		expect(reset.routine.days[0].exercises[0]).toStrictEqual({ exerciseId: INCLINE_DB, sets: 4 });
	});

	it("moves exercises between days and removes them", () => {
		const moved = run("move_exercise", { day_id: "d1", index: 0, to_day_id: "d2" });
		expect(moved.routine.days.map((d) => d.exercises.length)).toEqual([0, 1]);
		const removed = run("remove_exercise", { day_id: "d2", index: 0 }, moved.routine);
		expect(removed.routine.days[1].exercises).toEqual([]);
	});

	it("returns errors Claude can correct instead of throwing", () => {
		const r = base();
		for (const [name, input, message] of [
			["add_exercise", { day_id: "nope", exercise_id: BENCH, sets: 3 }, /No day with id "nope"/],
			["add_exercise", { day_id: "d1", exercise_id: "made-up", sets: 3 }, /search_exercises/],
			["add_exercise", { day_id: "d1", exercise_id: "ex57", sets: 3 }, /No exercise/],
			["add_exercise", { day_id: "d1", exercise_id: BENCH, sets: 30 }, /Invalid input/],
			["remove_exercise", { day_id: "d1", index: 5 }, /out of range/],
			["delete_everything", {}, /Unknown tool/],
		] as const) {
			const outcome = runCoachTool(name, input, r, ctx);
			expect(outcome.isError, name).toBe(true);
			expect(outcome.result).toMatch(message);
			expect(outcome.routine).toBe(r);
		}
	});

	it("analyzes volume against landmarks and priorities", () => {
		const { result, change } = run("analyze_routine", {});
		expect(change).toBeUndefined();
		expect(result).toMatch(/Chest \(tier S\): 3\.0 sets\/week over 1 sessions, below maintenance \(MV\) \[MV 4,/);
		expect(result).toMatch(/Neck \(tier unranked\): 0\.0 sets/);
	});

	it("generates tool schemas from the validation schemas", () => {
		const schemas = coachToolSchemas();
		const add = schemas.find((s) => s.name === "add_exercise")!;
		expect(add.inputSchema).not.toHaveProperty("$schema");
		expect(add.inputSchema).toMatchObject({
			type: "object",
			required: ["day_id", "exercise_id", "sets"],
		});
	});
});

/** A stand-in for the SDK client that replays scripted responses. */
function fakeClient(responses: Partial<Anthropic.Beta.BetaMessage>[]) {
	const requests: Anthropic.Beta.MessageCreateParams[] = [];
	const client = {
		beta: {
			messages: {
				stream: (params: Anthropic.Beta.MessageCreateParams) => {
					requests.push(structuredClone(params));
					const message = responses.shift()!;
					return {
						on: (_event: string, cb: (text: string) => void) => {
							for (const b of message.content ?? []) if (b.type === "text") cb(b.text);
						},
						finalMessage: async () => message,
					};
				},
			},
		},
	} as unknown as Anthropic;
	return { client, requests };
}

const toolUse = (id: string, name: string, input: unknown) =>
	({ type: "tool_use", id, name, input }) as Anthropic.Beta.BetaToolUseBlock;
const text = (t: string) => ({ type: "text", text: t }) as Anthropic.Beta.BetaTextBlock;

describe("runCoachTurn", () => {
	it("runs tools against the draft until Claude ends its turn", async () => {
		const { client, requests } = fakeClient([
			{
				stop_reason: "tool_use",
				content: [
					text("Adding laterals."),
					toolUse("t1", "add_exercise", { day_id: "d1", exercise_id: LATERAL, sets: 3 }),
					toolUse("t2", "analyze_routine", {}),
				],
			},
			{ stop_reason: "end_turn", content: [text("Done.")] },
		]);
		const streamed: string[] = [];
		const result = await runCoachTurn({
			client,
			history: [],
			userText: "Add lateral raises",
			routine: base(),
			ctx,
			onText: (t) => streamed.push(t),
			onChange: () => {},
		});

		expect(result.changes).toEqual(["Added Lateral Raise (Dumbbell) (3 sets) to Push"]);
		expect(result.routine.days[0].exercises).toHaveLength(2);
		expect(streamed.join("")).toBe("Adding laterals.\n\nDone.");
		// Both results go back in one user message, in order.
		const toolResults = requests[1].messages.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[];
		expect(toolResults.map((r) => r.tool_use_id)).toEqual(["t1", "t2"]);
		// The first user message carries the routine as it was.
		const first = requests[0].messages[0].content as Anthropic.Beta.BetaTextBlockParam[];
		expect(first[0].text).toContain('Day "Push" [d1], 3 sets');
		expect(first[1].text).toBe("Add lateral raises");
		expect(requests[0]).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default" });
		expect(result.history).toHaveLength(4);
	});

	it("never runs tools from a turn cut off by max_tokens, and keeps the history valid", async () => {
		const { client } = fakeClient([
			{
				stop_reason: "max_tokens",
				content: [toolUse("t1", "remove_day", { day_id: "d1" })],
			},
		]);
		const result = await runCoachTurn({
			client,
			history: [],
			userText: "Remove push day",
			routine: base(),
			ctx,
			onText: () => {},
			onChange: () => {},
		});
		expect(result.stopReason).toBe("max_tokens");
		expect(result.routine.days).toHaveLength(2);
		const last = result.history.at(-1)!;
		expect(last.role).toBe("user");
		expect((last.content as Anthropic.Beta.BetaToolResultBlockParam[])[0]).toMatchObject({
			tool_use_id: "t1",
			is_error: true,
		});
	});
});
