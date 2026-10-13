"use client";

import { useAccountSyncedState } from "@/hooks/use-account-synced-state";
import { getSettingFromFirebase, saveSettingToFirebase } from "./firebase-storage";
import { loadTrainingDefaults, saveTrainingDefaults } from "./storage";
import { DEFAULT_TRAINING_DEFAULTS } from "./training-defaults";
import type { TrainingDefaults } from "./types";
import type React from "react";
import { createContext, useContext } from "react";

interface SettingsContextType {
	defaults: TrainingDefaults;
	setDefaults: (value: TrainingDefaults | ((prev: TrainingDefaults) => TrainingDefaults)) => void;
}

const SettingsContext = createContext<SettingsContextType>({
	defaults: DEFAULT_TRAINING_DEFAULTS,
	setDefaults: () => {},
});

const local = { save: saveTrainingDefaults, load: loadTrainingDefaults };
const remote = {
	save: (userId: string, value: TrainingDefaults) =>
		saveSettingToFirebase(userId, "trainingDefaults", value),
	load: (userId: string) => getSettingFromFirebase<TrainingDefaults>(userId, "trainingDefaults"),
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
	const [defaults, setDefaults] = useAccountSyncedState(
		"trainingDefaults",
		DEFAULT_TRAINING_DEFAULTS,
		local,
		remote
	);
	return (
		<SettingsContext.Provider value={{ defaults, setDefaults }}>
			{children}
		</SettingsContext.Provider>
	);
}

export const useSettings = () => useContext(SettingsContext);
