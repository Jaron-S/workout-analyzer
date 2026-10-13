// Shared between the app and the Claude connector: where a Claude draft, the
// undo snapshot and the routine open in the app live in Firestore. Each is a
// settings document holding { value, updatedAt }, like the other settings.

import type { Routine } from "./types";

export const SETTINGS = {
	/** The id of the routine open in the app, so Claude works on the same one. */
	currentRoutine: "currentRoutine",
	/** Claude's proposed changes to that routine, awaiting review. */
	draft: "claudeDraft",
	/** The routine as it was before Claude's last applied change. */
	undo: "claudeUndo",
} as const;

export interface ClaudeDraft {
	routineId: string;
	routine: Routine;
	/** One line per change, for review. */
	changes: string[];
}

export interface ClaudeUndo {
	routineId: string;
	routine: Routine;
}
