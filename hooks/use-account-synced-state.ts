"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useRef } from "react";
import { usePersistedState } from "./use-persisted-state";

/**
 * State kept in localStorage and, while signed in, in the user's account.
 * On sign-in the account's copy wins; if the account has none yet, the copy
 * made on this device as a guest is uploaded.
 */
export function useAccountSyncedState<T>(
	key: string,
	initialValue: T,
	local: { save: (value: T) => void; load: () => T | null },
	remote: {
		save: (userId: string, value: T) => Promise<void>;
		load: (userId: string) => Promise<T | null>;
	}
): [T, (value: T | ((prev: T) => T)) => void] {
	const { user } = useAuth();
	const [state, setState] = usePersistedState<T>(key, initialValue, local.save, local.load);

	// JSON of the value last read from or written to the account, so loading
	// it does not immediately write it back. null until the first load ends.
	const syncedRef = useRef<string | null>(null);

	// Read through refs so callers can pass inline objects, and so the
	// sign-in effect sees the latest local value.
	const remoteRef = useRef(remote);
	remoteRef.current = remote;
	const stateRef = useRef(state);
	stateRef.current = state;
	const initialJson = useRef(JSON.stringify(initialValue)).current;

	useEffect(() => {
		syncedRef.current = null;
		if (!user) return;
		let cancelled = false;
		remoteRef.current
			.load(user.uid)
			.then((value) => {
				if (cancelled) return;
				if (value !== null) {
					syncedRef.current = JSON.stringify(value);
					setState(value);
				} else {
					const json = JSON.stringify(stateRef.current);
					syncedRef.current = json;
					if (json !== initialJson) {
						remoteRef.current
							.save(user.uid, stateRef.current)
							.catch((error) => console.error(`Failed to save ${key}:`, error));
					}
				}
			})
			.catch((error) => console.error(`Failed to load ${key}:`, error));
		return () => {
			cancelled = true;
		};
	}, [user, key, setState, initialJson]);

	useEffect(() => {
		if (!user || syncedRef.current === null) return;
		const json = JSON.stringify(state);
		if (json === syncedRef.current) return;
		syncedRef.current = json;
		remoteRef.current
			.save(user.uid, state)
			.catch((error) => console.error(`Failed to save ${key}:`, error));
	}, [user, key, state]);

	return [state, setState];
}
