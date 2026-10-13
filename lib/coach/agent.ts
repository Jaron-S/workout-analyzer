import Anthropic from "@anthropic-ai/sdk";
import type { Routine } from "../types";
import { coachToolSchemas, describeRoutine, runCoachTool, type CoachContext } from "./tools";

export const COACH_MODEL = "claude-opus-5-5";

// Fixed text, so with the tools it forms a cacheable prefix. Anything that
// changes (the routine, priorities, defaults) goes in the user turn instead.
const SYSTEM_PROMPT = `You are the coach inside Setsmith, an app for planning hypertrophy training. You help the user build and adjust their weekly routine and explain the reasoning.

How the app models training:
- A routine is a week of training days. Each day lists exercises with a number of working sets (1-10). Reps, rest and, for timed exercises, seconds per set come from the user's defaults (split by compound and isolation) unless an exercise sets its own.
- Each exercise has muscle weightings: a set counts fully for its main muscle and partly for others (e.g. bench press: Chest 100%, Front Delts 40%, Triceps 30%). Users can override weightings to match how exercises feel for their body.
- Weekly volume per muscle is compared with landmarks: MV (maintenance), MEV (minimum effective), MAV (the productive range) and MRV (maximum recoverable).
- The user ranks muscles into priority tiers S (most important) to F (least). Higher tiers should land in or near MAV; low tiers can sit at maintenance.
- Exercises come from the Hevy app's library, so routines can be pushed to Hevy.

How to work:
- Your edits go to a draft. The user reviews the changes and applies or discards them, so make the changes you recommend rather than asking permission for each one, unless the request is ambiguous enough that a wrong guess would waste their time.
- Find exercise ids with search_exercises; never guess an id.
- Leave reps and rest at the defaults unless an exercise genuinely needs different ones.
- After editing, run analyze_routine and adjust if volume or session fatigue is off for the user's priorities.
- Each message from the user starts with the routine and settings as they are now. If it differs from what you last saw, the user edited it or discarded your draft; work from the new version.
- Write plain text: short paragraphs and "-" lists, no headings or tables. Be concise; the changes themselves appear in the review list, so summarize them rather than repeating every one.`;

export interface CoachTurnOptions {
	client: Anthropic;
	/** Conversation so far; never edited, only appended to. */
	history: Anthropic.Beta.BetaMessageParam[];
	userText: string;
	routine: Routine;
	ctx: CoachContext;
	onText: (delta: string) => void;
	/** Called after each tool that changes the draft. */
	onChange: (routine: Routine, change: string) => void;
	onToolCall?: (name: string) => void;
	signal?: AbortSignal;
}

export interface CoachTurnResult {
	history: Anthropic.Beta.BetaMessageParam[];
	routine: Routine;
	changes: string[];
	stopReason: string | null;
}

const MAX_ITERATIONS = 30;
const MAX_JSON_RETRIES = 2;

export function createCoachClient(apiKey: string) {
	// The key is the user's own and stays in their browser.
	return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

function contextBlock(routine: Routine, ctx: CoachContext): string {
	const d = ctx.defaults;
	const tiers = Object.entries(ctx.priorities)
		.filter(([, muscles]) => muscles?.length)
		.map(([tier, muscles]) => `${tier}: ${muscles!.join(", ")}`);
	return [
		"<current_routine>",
		describeRoutine(routine, ctx),
		"</current_routine>",
		"<settings>",
		`Defaults: compound ${d.reps.compound.min}-${d.reps.compound.max} reps, ${d.restSeconds.compound}s rest; isolation ${d.reps.isolation.min}-${d.reps.isolation.max} reps, ${d.restSeconds.isolation}s rest; timed ${d.durationSeconds}s per set. Weight unit: ${d.weightUnit}.`,
		`Priority tiers: ${tiers.length ? tiers.join("; ") : "not set"}.`,
		"</settings>",
	].join("\n");
}

const TOOLS: Anthropic.Beta.BetaTool[] = coachToolSchemas().map((t) => ({
	name: t.name,
	description: t.description,
	input_schema: t.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
	// Inputs stream as generated; runCoachTool validates them before running.
	eager_input_streaming: true,
}));

/** One user message, run until Claude stops calling tools. */
export async function runCoachTurn(options: CoachTurnOptions): Promise<CoachTurnResult> {
	const { client, ctx, onText, onChange, onToolCall, signal } = options;
	let routine = options.routine;
	const changes: string[] = [];
	const history: Anthropic.Beta.BetaMessageParam[] = [
		...options.history,
		{
			role: "user",
			content: [
				{ type: "text", text: contextBlock(routine, ctx) },
				{ type: "text", text: options.userText },
			],
		},
	];

	let jsonRetries = 0;
	let wroteText = false;
	for (let i = 0; i < MAX_ITERATIONS; i++) {
		const stream = client.beta.messages.stream(
			{
				model: COACH_MODEL,
				max_tokens: 32000,
				output_config: { effort: "medium" },
				// Caches the growing conversation between requests.
				cache_control: { type: "ephemeral" },
				system: SYSTEM_PROMPT,
				tools: TOOLS,
				messages: history,
				// If a safety classifier declines, retry on a suitable model.
				betas: ["server-side-fallback-2026-07-01"],
				fallbacks: "default",
			},
			{ signal }
		);
		// Text from separate steps (before and after a tool call) would
		// otherwise run together into one sentence.
		let firstDelta = true;
		stream.on("text", (delta) => {
			onText(firstDelta && wroteText ? `\n\n${delta}` : delta);
			firstDelta = false;
			wroteText = true;
		});

		let message: Anthropic.Beta.BetaMessage;
		try {
			message = await stream.finalMessage();
			jsonRetries = 0;
		} catch (error) {
			// Only a tool input that could not be parsed is retried; the failed
			// turn was never appended, so re-sending repeats it cleanly.
			if (error instanceof Anthropic.APIError || signal?.aborted || jsonRetries++ >= MAX_JSON_RETRIES) {
				throw error;
			}
			continue;
		}

		const toolUses = message.content.filter(
			(b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use"
		);
		// Thinking and fallback blocks must go back exactly as received.
		history.push({ role: "assistant", content: message.content });

		if (message.stop_reason === "pause_turn") continue;
		// A refusal or max_tokens can cut a tool call off mid-input, so never
		// run that turn's tools.
		if (message.stop_reason === "refusal" || message.stop_reason === "max_tokens") {
			return { history: closeOpenToolCalls(history, toolUses), routine, changes, stopReason: message.stop_reason };
		}
		if (toolUses.length === 0) {
			return { history, routine, changes, stopReason: message.stop_reason };
		}

		const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((use) => {
			onToolCall?.(use.name);
			const outcome = runCoachTool(use.name, use.input, routine, ctx);
			if (outcome.change && !outcome.isError) {
				routine = outcome.routine;
				changes.push(outcome.change);
				onChange(routine, outcome.change);
			}
			return {
				type: "tool_result",
				tool_use_id: use.id,
				content: outcome.result,
				...(outcome.isError ? { is_error: true } : {}),
			};
		});
		history.push({ role: "user", content: results });
	}

	// Ran out of iterations. The last entry is a tool_result turn, so the
	// history is still valid to continue from.
	return { history, routine, changes, stopReason: "max_iterations" };
}

/** Tool calls left unanswered would make the next request invalid. */
function closeOpenToolCalls(
	history: Anthropic.Beta.BetaMessageParam[],
	toolUses: Anthropic.Beta.BetaToolUseBlock[]
): Anthropic.Beta.BetaMessageParam[] {
	if (toolUses.length === 0) return history;
	return [
		...history,
		{
			role: "user",
			content: toolUses.map((use) => ({
				type: "tool_result" as const,
				tool_use_id: use.id,
				content: "Not run: the response was cut off.",
				is_error: true,
			})),
		},
	];
}

