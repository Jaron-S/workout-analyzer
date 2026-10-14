"use client";

import { SETTINGS, type ClaudeDraft } from "@/lib/claude-sync";
import { db } from "@/lib/firebase-config";
import { isOwnRoutineWrite } from "@/lib/firebase-storage";
import { saveSyncedRoutine, stableJson, syncedRoutineJson } from "@/lib/storage";
import type { Routine } from "@/lib/types";
import type { User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useRef } from "react";
import type { Coach } from "./use-coach";

const strip = ({ updatedAt: _u, ...routine }: Record<string, unknown>) => routine as unknown as Routine;

/**
 * Keeps the open routine in step with the account while signed in:
 * - a draft Claude makes through the connector shows for review, and goes
 *   away if it's applied or discarded in the chat;
 * - the routine updates when it's saved elsewhere (Claude applying changes,
 *   or another device), but never from this browser's own saves.
 */
export function useClaudeSync(user: User | null, routine: Routine, setRoutine: (r: Routine) => void, coach: Coach) {
	// Read through refs so the listeners don't resubscribe on every change.
	const latest = useRef({ routine, setRoutine, coach });
	latest.current = { routine, setRoutine, coach };

	useEffect(() => {
		if (!user || !db) return;
		return onSnapshot(doc(db, "users", user.uid, "settings", SETTINGS.draft), (snap) => {
			const { routine, coach } = latest.current;
			const draft = snap.exists() ? (snap.data().value as ClaudeDraft) : null;
			if (draft && draft.routineId === routine.id) {
				coach.showDraft(draft.routine, draft.changes);
			} else if (!draft && coach.draftSource === "connector") {
				coach.discard();
			}
		});
	}, [user]);

	useEffect(() => {
		if (!user || !db) return;
		return onSnapshot(doc(db, "users", user.uid, "routines", routine.id), (snap) => {
			if (!snap.exists() || snap.metadata.hasPendingWrites) return;
			const data = snap.data();
			if (isOwnRoutineWrite(data.updatedAt)) return;
			const remote = strip(data);
			const { routine: local, setRoutine } = latest.current;
			const remoteJson = stableJson(remote);
			const localJson = stableJson(local);
			if (remoteJson === localJson) {
				saveSyncedRoutine(remote);
				return;
			}
			// Adopt the account's version only if the local routine is exactly
			// what was last synced. Unsynced local edits (or a routine this
			// browser never synced) win, and auto-save sends them up shortly.
			const synced = syncedRoutineJson(local.id);
			if (synced === localJson) {
				setRoutine(remote);
				saveSyncedRoutine(remote);
			}
		});
	}, [user, routine.id]);
}
