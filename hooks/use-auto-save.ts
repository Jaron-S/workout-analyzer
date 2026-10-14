"use client";

import { savePrioritiesToFirebase, saveRoutineToFirebase } from "@/lib/firebase-storage";
import { saveSyncedRoutine, stableJson, syncedRoutineJson } from "@/lib/storage";
import type { PriorityTier, Routine } from "@/lib/types";
import type { User } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const DELAY_MS = 1200;

/**
 * Saves the routine and priorities to the signed-in user's account shortly
 * after they stop changing. Returns the status and a way to retry a failure.
 */
export function useAutoSave(
	user: User | null,
	routine: Routine,
	priorities: Partial<Record<PriorityTier, string[]>>
): { status: SaveStatus; retry: () => void } {
	const [status, setStatus] = useState<SaveStatus>("idle");
	const lastSaved = useRef<{ routine: string; priorities: string } | null>(null);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		if (!user) {
			lastSaved.current = null;
			setStatus("idle");
			return;
		}
		const routineJson = JSON.stringify(routine);
		const prioritiesJson = JSON.stringify(priorities);
		const prev = lastSaved.current;
		if (prev && prev.routine === routineJson && prev.priorities === prioritiesJson) return;

		const timer = setTimeout(async () => {
			setStatus("saving");
			try {
				// Only upload a routine that differs from what the account already
				// has: re-uploading an unchanged copy on load could overwrite a newer
				// change made elsewhere (Claude, another device) moments before.
				if (prev?.routine !== routineJson && syncedRoutineJson(routine.id) !== stableJson(routine)) {
					await saveRoutineToFirebase(user.uid, routine);
					saveSyncedRoutine(routine);
				}
				if (prev?.priorities !== prioritiesJson) await savePrioritiesToFirebase(user.uid, priorities);
				lastSaved.current = { routine: routineJson, priorities: prioritiesJson };
				setStatus("saved");
			} catch (error) {
				console.error("Auto-save failed:", error);
				setStatus("error");
			}
		}, DELAY_MS);
		return () => clearTimeout(timer);
	}, [user, routine, priorities, attempt]);

	const retry = useCallback(() => setAttempt((n) => n + 1), []);
	return { status, retry };
}
