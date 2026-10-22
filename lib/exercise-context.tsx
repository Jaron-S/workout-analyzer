"use client";

import { useAccountSyncedState } from "@/hooks/use-account-synced-state";
import { buildCatalog } from "./exercise-catalog";
import { rankingsFor, type Rankings } from "./exercise-rankings";
import { getSettingFromFirebase, saveSettingToFirebase, subscribeToSetting } from "./firebase-storage";
import { customTemplateToExercise } from "./hevy/exercises";
import { useHevy } from "./hevy-context";
import { loadExercisePreferences, loadMuscleOverrides, saveExercisePreferences, saveMuscleOverrides } from "./storage";
import type { Exercise, ExercisePreference, ExercisePreferences, MuscleOverrides } from "./types";
import type React from "react";
import { createContext, useCallback, useContext, useMemo } from "react";

interface ExerciseContextType {
	exercises: Exercise[];
	getExercise: (id: string) => Exercise | undefined;
	/** Replace an exercise's muscle weightings for this user; null restores the defaults. */
	setMuscleOverride: (id: string, muscles: Record<string, number> | null) => void;
	hasMuscleOverride: (id: string) => boolean;
	/** Tiers from the built-in tier lists. */
	rankings: Rankings;
	/** The user's favourites and exercises to avoid. */
	preferences: ExercisePreferences;
	/** Sets or (with null) clears how the user feels about an exercise. */
	setPreference: (id: string, preference: ExercisePreference | null) => void;
	setPreferences: (preferences: ExercisePreferences) => void;
}

const ExerciseContext = createContext<ExerciseContextType>({
	exercises: [],
	getExercise: () => undefined,
	setMuscleOverride: () => {},
	hasMuscleOverride: () => false,
	rankings: rankingsFor([]),
	preferences: {},
	setPreference: () => {},
	setPreferences: () => {},
});

const local = { save: saveMuscleOverrides, load: loadMuscleOverrides };
const remote = {
	save: (userId: string, value: MuscleOverrides) =>
		saveSettingToFirebase(userId, "muscleOverrides", value),
	load: (userId: string) => getSettingFromFirebase<MuscleOverrides>(userId, "muscleOverrides"),
};

const localPreferences = { save: saveExercisePreferences, load: loadExercisePreferences };
const remotePreferences = {
	save: (userId: string, value: ExercisePreferences) =>
		saveSettingToFirebase(userId, "exercisePreferences", value),
	load: (userId: string) => getSettingFromFirebase<ExercisePreferences>(userId, "exercisePreferences"),
	// Live, because Claude in claude.ai can change them too.
	subscribe: (userId: string, onValue: (value: ExercisePreferences | null) => void, onError: (error: Error) => void) =>
		subscribeToSetting(userId, "exercisePreferences", onValue, onError),
};

export function ExerciseProvider({ children }: { children: React.ReactNode }) {
	const { customTemplates } = useHevy();
	const [overrides, setOverrides] = useAccountSyncedState<MuscleOverrides>(
		"muscleOverrides",
		{},
		local,
		remote
	);

	const [preferences, setPreferences] = useAccountSyncedState<ExercisePreferences>(
		"exercisePreferences",
		{},
		localPreferences,
		remotePreferences
	);

	const customExercises = useMemo(
		() => customTemplates.map(customTemplateToExercise),
		[customTemplates]
	);
	const exercises = useMemo(
		() => buildCatalog(overrides, customExercises),
		[overrides, customExercises]
	);
	const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
	const getExercise = useCallback((id: string) => byId.get(id), [byId]);
	const hasMuscleOverride = useCallback((id: string) => id in overrides, [overrides]);

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

	const rankings = useMemo(() => rankingsFor(exercises), [exercises]);
	const setPreference = useCallback(
		(id: string, preference: ExercisePreference | null) => {
			setPreferences((prev) => {
				const next = { ...prev };
				if (preference) next[id] = preference;
				else delete next[id];
				return next;
			});
		},
		[setPreferences]
	);

	return (
		<ExerciseContext.Provider
			value={{
				exercises,
				getExercise,
				setMuscleOverride,
				hasMuscleOverride,
				rankings,
				preferences,
				setPreference,
				setPreferences,
			}}
		>
			{children}
		</ExerciseContext.Provider>
	);
}

export const useExercises = () => useContext(ExerciseContext);
