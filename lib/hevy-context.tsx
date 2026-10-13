"use client";

import { usePersistedState } from "@/hooks/use-persisted-state";
import {
	createHevyClient,
	type HevyClient,
	type HevyExerciseTemplate,
	type HevyUserInfo,
} from "./hevy/client";
import { useSettings } from "./settings-context";
import {
	loadHevyApiKey,
	loadHevyCustomExercises,
	saveHevyApiKey,
	saveHevyCustomExercises,
} from "./storage";
import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface HevyContextType {
	/** Null until the user has connected Hevy on this device. */
	client: HevyClient | null;
	account: HevyUserInfo | null;
	error: string | null;
	/** The user's Hevy custom exercises, cached on this device. */
	customTemplates: HevyExerciseTemplate[];
	connect: (apiKey: string) => Promise<HevyUserInfo>;
	disconnect: () => void;
	/** Re-fetches every exercise the account has, built-in and custom. */
	refreshExercises: () => Promise<HevyExerciseTemplate[]>;
}

const HevyContext = createContext<HevyContextType>({
	client: null,
	account: null,
	error: null,
	customTemplates: [],
	connect: async () => {
		throw new Error("HevyProvider missing");
	},
	disconnect: () => {},
	refreshExercises: async () => [],
});

const toWeightUnit = (hevyUnit: string) => (hevyUnit.startsWith("k") ? "kg" : "lb");

export function HevyProvider({ children }: { children: React.ReactNode }) {
	const { setDefaults } = useSettings();
	const [apiKey, setApiKey] = usePersistedState<string>("hevyApiKey", "", saveHevyApiKey, loadHevyApiKey);
	const [customTemplates, setCustomTemplates] = usePersistedState<HevyExerciseTemplate[]>(
		"hevyCustomExercises",
		[],
		saveHevyCustomExercises,
		loadHevyCustomExercises
	);
	const [account, setAccount] = useState<HevyUserInfo | null>(null);
	const [error, setError] = useState<string | null>(null);

	const client = useMemo(() => (apiKey ? createHevyClient(apiKey) : null), [apiKey]);

	// Confirm a stored key still works and show whose account it is.
	useEffect(() => {
		if (!client) {
			setAccount(null);
			return;
		}
		let cancelled = false;
		client
			.getUserInfo()
			.then((info) => {
				if (cancelled) return;
				setAccount(info);
				setError(null);
			})
			.catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
		return () => {
			cancelled = true;
		};
	}, [client]);

	const fetchExercises = useCallback(async (target: HevyClient) => {
		const templates = await target.getExerciseTemplates();
		setCustomTemplates(templates.filter((t) => t.is_custom));
		return templates;
	}, [setCustomTemplates]);

	const connect = useCallback(
		async (newKey: string) => {
			const trimmed = newKey.trim();
			const newClient = createHevyClient(trimmed);
			const info = await newClient.getUserInfo();
			await fetchExercises(newClient);
			setApiKey(trimmed);
			setAccount(info);
			setError(null);
			setDefaults((prev) => ({ ...prev, weightUnit: toWeightUnit(info.weight_unit) }));
			return info;
		},
		[fetchExercises, setApiKey, setDefaults]
	);

	const disconnect = useCallback(() => {
		setApiKey("");
		setCustomTemplates([]);
		setAccount(null);
		setError(null);
	}, [setApiKey, setCustomTemplates]);

	const refreshExercises = useCallback(async () => {
		if (!client) throw new Error("Connect Hevy first.");
		return fetchExercises(client);
	}, [client, fetchExercises]);

	return (
		<HevyContext.Provider
			value={{ client, account, error, customTemplates, connect, disconnect, refreshExercises }}
		>
			{children}
		</HevyContext.Provider>
	);
}

export const useHevy = () => useContext(HevyContext);
