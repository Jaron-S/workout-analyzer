import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	setDoc,
} from "firebase/firestore";
import { db } from "./firebase-config";
import { migrateRoutine } from "./exercise-catalog";
import type { PriorityTier, Routine } from "./types";

// The updatedAt stamps of routines this browser saved, so a live listener
// can tell its own writes from the connector's or another device's.
const ownWrites = new Set<string>();
export const isOwnRoutineWrite = (updatedAt: unknown) => typeof updatedAt === "string" && ownWrites.has(updatedAt);

export async function saveRoutineToFirebase(userId: string, routine: Routine) {
	if (!db) throw new Error("Firebase not configured");

	const updatedAt = new Date().toISOString();
	ownWrites.add(updatedAt);
	const routineRef = doc(db, "users", userId, "routines", routine.id);
	await setDoc(routineRef, { ...routine, updatedAt });
}

export async function getRoutinesFromFirebase(
	userId: string
): Promise<Routine[]> {
	if (!db) throw new Error("Firebase not configured");

	const routinesRef = collection(db, "users", userId, "routines");
	const snapshot = await getDocs(routinesRef);

	return snapshot.docs.map((doc) => migrateRoutine(doc.data() as Routine));
}

export async function deleteRoutineFromFirebase(
	userId: string,
	routineId: string
): Promise<void> {
	if (!db) throw new Error("Firebase not configured");

	// Create a reference to the specific routine document you want to delete
	const routineRef = doc(db, "users", userId, "routines", routineId);

	// Delete the document
	await deleteDoc(routineRef);
}

export async function savePrioritiesToFirebase(
	userId: string,
	priorities: Partial<Record<PriorityTier, string[]>>
) {
	if (!db) throw new Error("Firebase not configured");

	const prioritiesRef = doc(db, "users", userId, "settings", "priorities");
	await setDoc(prioritiesRef, {
		priorities,
		updatedAt: new Date().toISOString(),
	});
}

export async function getPrioritiesFromFirebase(
	userId: string
): Promise<Partial<Record<PriorityTier, string[]>>> {
	if (!db) throw new Error("Firebase not configured");

	const prioritiesRef = doc(db, "users", userId, "settings", "priorities");
	const snapshot = await getDoc(prioritiesRef);

	return snapshot.exists()
		? (snapshot.data().priorities as Partial<Record<PriorityTier, string[]>>)
		: {};
}

/** A per-user settings document holding one value, e.g. muscle overrides. */
export async function saveSettingToFirebase<T>(
	userId: string,
	name: string,
	value: T
): Promise<void> {
	if (!db) throw new Error("Firebase not configured");

	const settingRef = doc(db, "users", userId, "settings", name);
	await setDoc(settingRef, {
		value,
		updatedAt: new Date().toISOString(),
	});
}

export async function getSettingFromFirebase<T>(
	userId: string,
	name: string
): Promise<T | null> {
	if (!db) throw new Error("Firebase not configured");

	const settingRef = doc(db, "users", userId, "settings", name);
	const snapshot = await getDoc(settingRef);

	return snapshot.exists() ? (snapshot.data().value as T) : null;
}

export async function deleteSettingFromFirebase(userId: string, name: string): Promise<void> {
	if (!db) throw new Error("Firebase not configured");
	await deleteDoc(doc(db, "users", userId, "settings", name));
}
