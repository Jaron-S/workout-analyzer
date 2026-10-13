"use client";

import { createCoachClient, runCoachTurn } from "@/lib/coach/agent";
import type { CoachContext } from "@/lib/coach/tools";
import { useExercises } from "@/lib/exercise-context";
import { useSettings } from "@/lib/settings-context";
import type { PriorityTier, Routine } from "@/lib/types";
import Anthropic from "@anthropic-ai/sdk";
import { useCallback, useMemo, useRef, useState } from "react";

export interface ChatMessage {
	role: "user" | "assistant";
	text: string;
	/** Edits Claude made during this reply. */
	changes?: string[];
	error?: string;
}

const TOOL_ACTIVITY: Record<string, string> = {
	search_exercises: "Searching exercises",
	analyze_routine: "Checking the analysis",
	get_routine: "Reading the routine",
};

function describeError(error: unknown): string {
	if (error instanceof Anthropic.AuthenticationError) {
		return "Anthropic rejected the API key. Check it in Settings.";
	}
	if (error instanceof Anthropic.PermissionDeniedError) {
		return "This API key isn't allowed to use the model. Check your Anthropic account.";
	}
	if (error instanceof Anthropic.RateLimitError) {
		return "Rate limited by Anthropic. Wait a moment and try again.";
	}
	if (error instanceof Anthropic.APIError && error.status === 529) {
		return "Claude is overloaded right now. Try again shortly.";
	}
	if (error instanceof Anthropic.APIConnectionError) {
		return "Couldn't reach Anthropic. Check your connection.";
	}
	return error instanceof Error ? error.message : String(error);
}

/**
 * Chat with Claude about the routine. Claude's edits collect in a draft that
 * the user applies or discards; the draft is shown in place of the routine
 * while it is pending.
 */
export function useCoach({
	routine,
	setRoutine,
	priorities,
}: {
	routine: Routine;
	setRoutine: (routine: Routine) => void;
	priorities: Partial<Record<PriorityTier, string[]>>;
}) {
	const { claudeApiKey, defaults } = useSettings();
	const { exercises, getExercise } = useExercises();
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [history, setHistory] = useState<Anthropic.Beta.BetaMessageParam[]>([]);
	const [draft, setDraft] = useState<Routine | null>(null);
	const [pendingChanges, setPendingChanges] = useState<string[]>([]);
	const [undoRoutine, setUndoRoutine] = useState<Routine | null>(null);
	const [busy, setBusy] = useState(false);
	const [activity, setActivity] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	const client = useMemo(
		() => (claudeApiKey ? createCoachClient(claudeApiKey) : null),
		[claudeApiKey]
	);

	const updateLast = (update: (message: ChatMessage) => ChatMessage) =>
		setMessages((prev) => [...prev.slice(0, -1), update(prev[prev.length - 1])]);

	const send = useCallback(
		async (text: string) => {
			if (!client || busy || !text.trim()) return;
			const ctx: CoachContext = { exercises, getExercise, defaults, priorities };
			const controller = new AbortController();
			abortRef.current = controller;
			setBusy(true);
			setActivity("Thinking");
			setUndoRoutine(null);
			setMessages((prev) => [
				...prev,
				{ role: "user", text },
				{ role: "assistant", text: "", changes: [] },
			]);

			try {
				const result = await runCoachTurn({
					client,
					history,
					userText: text,
					routine: draft ?? routine,
					ctx,
					signal: controller.signal,
					onText: (delta) => {
						setActivity(null);
						updateLast((m) => ({ ...m, text: m.text + delta }));
					},
					onToolCall: (name) => setActivity(TOOL_ACTIVITY[name] ?? "Editing the routine"),
					onChange: (next, change) => {
						setDraft(next);
						setPendingChanges((prev) => [...prev, change]);
						updateLast((m) => ({ ...m, changes: [...(m.changes ?? []), change] }));
					},
				});
				setHistory(result.history);
				if (result.stopReason === "refusal") {
					updateLast((m) => ({ ...m, error: "Claude declined to continue with this request." }));
				} else if (result.stopReason === "max_tokens" || result.stopReason === "max_iterations") {
					updateLast((m) => ({ ...m, error: "Claude's reply was cut short. Ask it to continue." }));
				}
			} catch (error) {
				// The failed turn never reached the history, so the conversation
				// continues from before it; any edits already made stay in the draft.
				updateLast((m) => ({
					...m,
					error: controller.signal.aborted ? "Stopped." : describeError(error),
				}));
			} finally {
				setBusy(false);
				setActivity(null);
				abortRef.current = null;
			}
		},
		[client, busy, exercises, getExercise, defaults, priorities, history, draft, routine]
	);

	const stop = useCallback(() => abortRef.current?.abort(), []);

	const apply = useCallback(() => {
		if (!draft) return;
		setUndoRoutine(routine);
		setRoutine(draft);
		setDraft(null);
		setPendingChanges([]);
	}, [draft, routine, setRoutine]);

	const discard = useCallback(() => {
		setDraft(null);
		setPendingChanges([]);
	}, []);

	const undo = useCallback(() => {
		if (!undoRoutine) return;
		setRoutine(undoRoutine);
		setUndoRoutine(null);
	}, [undoRoutine, setRoutine]);

	const reset = useCallback(() => {
		abortRef.current?.abort();
		setMessages([]);
		setHistory([]);
		setDraft(null);
		setPendingChanges([]);
		setUndoRoutine(null);
	}, []);

	return {
		ready: Boolean(client),
		messages,
		busy,
		activity,
		draft,
		/** Lets the user keep editing the draft by hand before applying it. */
		setDraft,
		pendingChanges,
		canUndo: Boolean(undoRoutine),
		send,
		stop,
		apply,
		discard,
		undo,
		reset,
	};
}

export type Coach = ReturnType<typeof useCoach>;
