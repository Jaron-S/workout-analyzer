"use client";

import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAuth } from "./auth-context";
import { buildCatalog } from "./exercise-catalog";
import {
	getMuscleOverridesFromFirebase,
	saveMuscleOverridesToFirebase,
} from "./firebase-storage";
import { loadMuscleOverrides, saveMuscleOverrides } from "./storage";
import type { Exercise, MuscleOverrides } from "./types";
import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
} from "react";

interface ExerciseContextType {
	exercises: Exercise[];
	getExercise: (id: string) => Exercise | undefined;
	/** Replace an exercise's muscle weightings for this user; null restores the defaults. */
	setMuscleOverride: (id: string, muscles: Record<string, number> | null) => void;
}

const ExerciseContext = createContext<ExerciseContextType>({
	exercises: [],
	getExercise: () => undefined,
	setMuscleOverride: () => {},
});

export function ExerciseProvider({ children }: { children: React.ReactNode }) {
	const { user } = useAuth();
	const [overrides, setOverrides] = usePersistedState<MuscleOverrides>(
		"muscleOverrides",
		{},
		saveMuscleOverrides,
		loadMuscleOverrides
	);

	// JSON of the overrides last read from or written to Firestore, so loading
	// them does not immediately write them back.
	const syncedRef = useRef<string | null>(null);

	// On sign-in, the account's overrides win; if it has none yet, upload the
	// ones made on this device as a guest.
	useEffect(() => {
		if (!user) {
			syncedRef.current = null;
			return;
		}
		let cancelled = false;
		getMuscleOverridesFromFirebase(user.uid)
			.then((remote) => {
				if (cancelled) return;
				if (remote) {
					syncedRef.current = JSON.stringify(remote);
					setOverrides(remote);
				} else {
					syncedRef.current = "";
				}
			})
			.catch((error) => console.error("Failed to load muscle overrides:", error));
		return () => {
			cancelled = true;
		};
	}, [user, setOverrides]);

	useEffect(() => {
		if (!user || syncedRef.current === null) return;
		const json = JSON.stringify(overrides);
		if (json === syncedRef.current) return;
		syncedRef.current = json;
		saveMuscleOverridesToFirebase(user.uid, overrides).catch((error) =>
			console.error("Failed to save muscle overrides:", error)
		);
	}, [user, overrides]);

	const exercises = useMemo(() => buildCatalog(overrides), [overrides]);
	const byId = useMemo(
		() => new Map(exercises.map((e) => [e.id, e])),
		[exercises]
	);
	const getExercise = useCallback((id: string) => byId.get(id), [byId]);

	const setMuscleOverride = useCallback(
		(id: string, muscles: Record<string, number> | null) => {
			setOverrides((prev) => {
				const next = { ...prev };
				if (muscles) next[id] = muscles;
				else delete next[id];
				return next;
			});
		},
		[setOverrides]
	);

	return (
		<ExerciseContext.Provider value={{ exercises, getExercise, setMuscleOverride }}>
			{children}
		</ExerciseContext.Provider>
	);
}

export const useExercises = () => useContext(ExerciseContext);
