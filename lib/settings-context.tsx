"use client";

import { useAccountSyncedState } from "@/hooks/use-account-synced-state";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { getSettingFromFirebase, saveSettingToFirebase } from "./firebase-storage";
import {
	loadClaudeApiKey,
	loadTrainingDefaults,
	saveClaudeApiKey,
	saveTrainingDefaults,
} from "./storage";
import { DEFAULT_TRAINING_DEFAULTS } from "./training-defaults";
import type { TrainingDefaults } from "./types";
import type React from "react";
import { createContext, useContext } from "react";

interface SettingsContextType {
	defaults: TrainingDefaults;
	setDefaults: (value: TrainingDefaults | ((prev: TrainingDefaults) => TrainingDefaults)) => void;
	/** The user's Anthropic API key, kept only in this browser. Empty when not set. */
	claudeApiKey: string;
	setClaudeApiKey: (key: string) => void;
}

const SettingsContext = createContext<SettingsContextType>({
	defaults: DEFAULT_TRAINING_DEFAULTS,
	setDefaults: () => {},
	claudeApiKey: "",
	setClaudeApiKey: () => {},
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
	const [claudeApiKey, setClaudeApiKey] = usePersistedState<string>(
		"claudeApiKey",
		"",
		saveClaudeApiKey,
		loadClaudeApiKey
	);
	return (
		<SettingsContext.Provider value={{ defaults, setDefaults, claudeApiKey, setClaudeApiKey }}>
			{children}
		</SettingsContext.Provider>
	);
}

export const useSettings = () => useContext(SettingsContext);
