"use client";

import { SETTINGS, type ClaudeDraft } from "@/lib/claude-sync";
import { db } from "@/lib/firebase-config";
import { isOwnRoutineWrite, saveRoutineToFirebase, saveSettingToFirebase } from "@/lib/firebase-storage";
import { saveSyncedRoutine, stableJson, syncedRoutineAt, syncedRoutineJson } from "@/lib/storage";
import type { Routine } from "@/lib/types";
import type { User } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Coach } from "./use-coach";

const strip = ({ updatedAt: _u, ...routine }: Record<string, unknown>) => routine as unknown as Routine;

/**
 * Keeps the open routine in step with the account while signed in:
 * - a draft Claude makes through the connector shows for review, and goes
 *   away if it's applied or discarded in the chat;
 * - the routine updates when it's saved elsewhere (Claude applying changes,
 *   or another device), but never from this browser's own saves;
 * - the account records which routine is open, and the app follows when
 *   Claude creates or switches routines.
 */
export function useClaudeSync(user: User | null, routine: Routine, setRoutine: (r: Routine) => void, coach: Coach) {
	// Read through refs so the listeners don't resubscribe on every change.
	const latest = useRef({ routine, setRoutine, coach });
	latest.current = { routine, setRoutine, coach };

	// Which routine is open. The account's record is read before this browser
	// writes it, so signing in can't overwrite a switch Claude made meanwhile.
	const pointerRead = useRef(false);

	useEffect(() => {
		pointerRead.current = false;
		if (!user || !db) return;
		const firestore = db;
		const pointerRef = doc(firestore, "users", user.uid, "settings", SETTINGS.currentRoutine);
		const recordOpen = (id: string) =>
			saveSettingToFirebase(user.uid, SETTINGS.currentRoutine, id).catch((e) => console.error("Failed to record the open routine:", e));

		return onSnapshot(pointerRef, async (snap) => {
			const first = !pointerRead.current;
			pointerRead.current = true;
			const { routine: local, setRoutine, coach } = latest.current;
			const id = snap.exists() ? (snap.data().value as string) : null;
			if (id === local.id) return;
			// On load, follow only a switch made after this browser last synced;
			// otherwise this browser's routine is the newer choice.
			const switchedAt = snap.exists() ? (snap.data().updatedAt as string | undefined) : undefined;
			const follow = id && (!first || (switchedAt ?? "") > (syncedRoutineAt(local.id) ?? ""));
			if (!follow) {
				await recordOpen(local.id);
				return;
			}
			const next = await getDoc(doc(firestore, "users", user.uid, "routines", id));
			if (!next.exists()) {
				await recordOpen(local.id);
				return;
			}
			// Keep the routine being left: unsynced edits are saved first.
			if (syncedRoutineJson(local.id) !== stableJson(local)) await saveRoutineToFirebase(user.uid, local);
			const routine = strip(next.data());
			coach.discard();
			setRoutine(routine);
			saveSyncedRoutine(routine);
			if (!first) toast(`Claude opened "${routine.name}"`, { description: `"${local.name}" is saved in My routines.` });
		});
	}, [user]);

	// After that, opening a routine here updates the record.
	useEffect(() => {
		if (!user || !pointerRead.current) return;
		saveSettingToFirebase(user.uid, SETTINGS.currentRoutine, routine.id).catch((e) =>
			console.error("Failed to record the open routine:", e)
		);
	}, [user, routine.id]);

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
