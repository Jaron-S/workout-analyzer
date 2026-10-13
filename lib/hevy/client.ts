// A small client for Hevy's public API (https://api.hevyapp.com/docs). The
// API allows browser requests, so the user's key never leaves their device.
//
// Verified against the live API on 2026-10-13: rep ranges, single rep targets,
// durations, rest and notes round-trip; folder_id on PUT moves the routine.
//
// Hevy cannot delete routines, folders or custom exercises through the API,
// so callers should create those only when the user has asked to.

const BASE_URL = "https://api.hevyapp.com";

export type HevySetType = "warmup" | "normal" | "failure" | "dropset";

export interface HevyUserInfo {
	id: string;
	username: string;
	name: string;
	url: string;
	weight_unit: string;
	distance_unit: string;
	is_pro: boolean;
}

export interface HevyExerciseTemplate {
	id: string;
	title: string;
	type: string;
	primary_muscle_group: string;
	secondary_muscle_groups: string[];
	equipment: string;
	is_custom: boolean;
	thumbnail_url: string | null;
}

export interface HevyRoutineSet {
	type: HevySetType;
	weight_kg: number | null;
	reps: number | null;
	distance_meters: number | null;
	duration_seconds: number | null;
	rep_range?: { start: number; end: number };
}

export interface HevyRoutineExercise {
	exercise_template_id: string;
	superset_id: number | null;
	rest_seconds: number | null;
	notes: string | null;
	sets: HevyRoutineSet[];
}

export interface HevyRoutine {
	id: string;
	title: string;
	folder_id: number | null;
	exercises: (HevyRoutineExercise & { title: string })[];
}

export interface HevyRoutineInput {
	title: string;
	notes: string | null;
	exercises: HevyRoutineExercise[];
}

export interface HevyCustomExerciseInput {
	title: string;
	exercise_type: string;
	equipment_category: string;
	muscle_group: string;
	other_muscles: string[];
}

export class HevyError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
		this.name = "HevyError";
	}
}

export type HevyClient = ReturnType<typeof createHevyClient>;

export function createHevyClient(apiKey: string, fetchImpl: typeof fetch = fetch) {
	async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const res = await fetchImpl(`${BASE_URL}${path}`, {
			method,
			headers: {
				"api-key": apiKey,
				...(body ? { "Content-Type": "application/json" } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
		});
		const text = await res.text();
		if (!res.ok) {
			let message = text;
			try {
				message = JSON.parse(text).error ?? text;
			} catch {}
			if (res.status === 401) message = "Hevy rejected the API key.";
			throw new HevyError(res.status, message || `Hevy API error ${res.status}`);
		}
		return (text ? JSON.parse(text) : {}) as T;
	}

	async function getAllPages<T>(path: string, key: string, pageSize: number): Promise<T[]> {
		const items: T[] = [];
		for (let page = 1; ; page++) {
			const body = await request<Record<string, unknown>>(
				"GET",
				`${path}?page=${page}&pageSize=${pageSize}`
			);
			items.push(...((body[key] as T[]) ?? []));
			if (page >= ((body.page_count as number) ?? 1)) return items;
		}
	}

	return {
		getUserInfo: async () =>
			(await request<{ data: HevyUserInfo }>("GET", "/v1/user/info")).data,

		getExerciseTemplates: () =>
			getAllPages<HevyExerciseTemplate>("/v1/exercise_templates", "exercise_templates", 100),

		getRoutines: () => getAllPages<HevyRoutine>("/v1/routines", "routines", 10),

		/** Resolves to null when the folder no longer exists. */
		getRoutineFolder: async (folderId: number) => {
			try {
				return await request<{ id: number; title: string }>(
					"GET",
					`/v1/routine_folders/${folderId}`
				);
			} catch (error) {
				if (error instanceof HevyError && error.status === 404) return null;
				throw error;
			}
		},

		createRoutineFolder: async (title: string) => {
			type Folder = { id: number; title: string };
			const body = await request<Folder | { routine_folder: Folder }>(
				"POST",
				"/v1/routine_folders",
				{ routine_folder: { title } }
			);
			// Documented as the bare folder, but Hevy wraps it in routine_folder.
			const folder = "routine_folder" in body ? body.routine_folder : body;
			if (typeof folder?.id !== "number") {
				throw new HevyError(500, "Hevy created the folder but didn't return its ID.");
			}
			return folder;
		},

		createRoutine: async (routine: HevyRoutineInput, folderId: number | null) => {
			const body = await request<{ routine: HevyRoutine | HevyRoutine[] }>(
				"POST",
				"/v1/routines",
				{ routine: { ...routine, folder_id: folderId } }
			);
			// Documented as an object; some API versions have returned a one-item array.
			return Array.isArray(body.routine) ? body.routine[0] : body.routine;
		},

		/** Resolves to null when the routine no longer exists in Hevy. */
		updateRoutine: async (
			routineId: string,
			routine: HevyRoutineInput,
			folderId: number | null
		) => {
			try {
				// folder_id also moves the routine back if it was moved out in Hevy.
				const body = await request<{ routine: HevyRoutine | HevyRoutine[] }>(
					"PUT",
					`/v1/routines/${routineId}`,
					{ routine: { ...routine, folder_id: folderId } }
				);
				return Array.isArray(body.routine) ? body.routine[0] : body.routine;
			} catch (error) {
				if (error instanceof HevyError && error.status === 404) return null;
				throw error;
			}
		},

		createCustomExercise: (exercise: HevyCustomExerciseInput) =>
			request<{ id: string | number }>("POST", "/v1/exercise_templates", { exercise }),
	};
}
