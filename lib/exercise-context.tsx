"use client";

import { useAccountSyncedState } from "@/hooks/use-account-synced-state";
import { buildCatalog } from "./exercise-catalog";
import { getSettingFromFirebase, saveSettingToFirebase } from "./firebase-storage";
import { customTemplateToExercise } from "./hevy/exercises";
import { useHevy } from "./hevy-context";
import { loadMuscleOverrides, saveMuscleOverrides } from "./storage";
import type { Exercise, MuscleOverrides } from "./types";
import type React from "react";
import { createContext, useCallback, useContext, useMemo } from "react";

interface ExerciseContextType {
	exercises: Exercise[];
	getExercise: (id: string) => Exercise | undefined;
	/** Replace an exercise's muscle weightings for this user; null restores the defaults. */
	setMuscleOverride: (id: string, muscles: Record<string, number> | null) => void;
	hasMuscleOverride: (id: string) => boolean;
}

const ExerciseContext = createContext<ExerciseContextType>({
	exercises: [],
	getExercise: () => undefined,
	setMuscleOverride: () => {},
	hasMuscleOverride: () => false,
});

const local = { save: saveMuscleOverrides, load: loadMuscleOverrides };
const remote = {
	save: (userId: string, value: MuscleOverrides) =>
		saveSettingToFirebase(userId, "muscleOverrides", value),
	load: (userId: string) => getSettingFromFirebase<MuscleOverrides>(userId, "muscleOverrides"),
};

export function ExerciseProvider({ children }: { children: React.ReactNode }) {
	const { customTemplates } = useHevy();
	const [overrides, setOverrides] = useAccountSyncedState<MuscleOverrides>(
		"muscleOverrides",
		{},
		local,
		remote
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

	return (
		<ExerciseContext.Provider
			value={{ exercises, getExercise, setMuscleOverride, hasMuscleOverride }}
		>
			{children}
		</ExerciseContext.Provider>
	);
}

export const useExercises = () => useContext(ExerciseContext);
