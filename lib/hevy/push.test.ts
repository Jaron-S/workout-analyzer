import { describe, expect, it } from "vitest";
import { buildCatalog } from "../exercise-catalog";
import { DEFAULT_TRAINING_DEFAULTS } from "../training-defaults";
import type { HevyLink, Routine } from "../types";
import { HevyError, type HevyClient, type HevyRoutineInput } from "./client";
import { buildDayRoutine, findUnresolvedExercises, pushRoutine, replaceExercise } from "./push";

const catalog = new Map(buildCatalog({}).map((e) => [e.id, e]));
const getExercise = (id: string) => catalog.get(id);

const BENCH = "79D0BB3A"; // Bench Press (Barbell): compound
const LATERAL = "422B08F1"; // Lateral Raise (Dumbbell): isolation
const PLANK = "C6C9B8A0"; // Plank: timed

const routine = (overrides: Partial<Routine> = {}): Routine => ({
	id: "r1",
	name: "Upper/Lower",
	days: [
		{ id: "d1", name: "Upper", exercises: [{ exerciseId: BENCH, sets: 3 }] },
		{ id: "d2", name: "Lower", exercises: [{ exerciseId: LATERAL, sets: 2 }] },
	],
	...overrides,
});

/** An in-memory Hevy account. failOn makes the nth write throw. */
function fakeHevy({ failOn }: { failOn?: number } = {}) {
	const folders = new Map<number, string>();
	const routines = new Map<string, HevyRoutineInput & { folderId: number | null }>();
	let nextId = 1;
	let writes = 0;
	const write = () => {
		writes++;
		if (writes === failOn) throw new HevyError(500, "Hevy is down");
	};
	const client = {
		getRoutineFolder: async (id: number) =>
			folders.has(id) ? { id, title: folders.get(id)! } : null,
		createRoutineFolder: async (title: string) => {
			write();
			const id = nextId++;
			folders.set(id, title);
			return { id, title };
		},
		createRoutine: async (body: HevyRoutineInput, folderId: number | null) => {
			write();
			const id = `routine-${nextId++}`;
			routines.set(id, { ...body, folderId });
			return { id, title: body.title, folder_id: folderId, exercises: [] };
		},
		updateRoutine: async (id: string, body: HevyRoutineInput, folderId: number | null) => {
			if (!routines.has(id)) return null;
			write();
			routines.set(id, { ...body, folderId });
			return { id, title: body.title, folder_id: null, exercises: [] };
		},
	} as unknown as HevyClient;
	return { client, folders, routines };
}

const push = (client: HevyClient, r: Routine, links: HevyLink[] = []) =>
	pushRoutine(client, r, getExercise, DEFAULT_TRAINING_DEFAULTS, (l) => links.push(l));

describe("buildDayRoutine", () => {
	it("uses rep ranges, rest by exercise kind, and no weights", () => {
		const body = buildDayRoutine(
			{
				id: "d",
				name: "Push",
				exercises: [
					{ exerciseId: BENCH, sets: 2 },
					{ exerciseId: LATERAL, sets: 1, reps: { min: 12, max: 12 }, notes: "  slow  " },
					{ exerciseId: PLANK, sets: 1 },
				],
			},
			getExercise,
			DEFAULT_TRAINING_DEFAULTS
		);
		const [bench, lateral, plank] = body.exercises;

		expect(bench.sets).toHaveLength(2);
		expect(bench.rest_seconds).toBe(150);
		expect(bench.sets[0]).toMatchObject({
			type: "normal",
			weight_kg: null,
			reps: null,
			rep_range: { start: 6, end: 10 },
		});

		// A single target is sent as reps, not a range.
		expect(lateral.rest_seconds).toBe(90);
		expect(lateral.sets[0]).toMatchObject({ reps: 12 });
		expect(lateral.sets[0]).not.toHaveProperty("rep_range");
		expect(lateral.notes).toBe("slow");

		expect(plank.sets[0]).toMatchObject({ reps: null, duration_seconds: 60 });
		expect(plank.sets[0]).not.toHaveProperty("rep_range");
	});
});

describe("pushRoutine", () => {
	it("creates a folder and one routine per day, then updates them in place", async () => {
		const hevy = fakeHevy();
		const first = await push(hevy.client, routine());
		expect(first.folderCreated).toBe(true);
		expect(first.created).toEqual(["Upper", "Lower"]);
		expect(hevy.routines.size).toBe(2);
		expect(first.link.folderId).not.toBeNull();
		expect([...hevy.routines.values()].every((r) => r.folderId === first.link.folderId)).toBe(true);

		const renamed = routine({ hevy: first.link });
		renamed.days[0].name = "Upper A";
		const second = await push(hevy.client, renamed);
		expect(second.folderCreated).toBe(false);
		expect(second.updated).toEqual(["Upper A", "Lower"]);
		expect(hevy.routines.size).toBe(2);
		expect(hevy.routines.get(first.link.dayRoutineIds.d1)!.title).toBe("Upper A");
	});

	it("recreates routines and folders deleted in Hevy", async () => {
		const hevy = fakeHevy();
		const first = await push(hevy.client, routine());
		hevy.routines.delete(first.link.dayRoutineIds.d1);
		hevy.folders.clear();

		const second = await push(hevy.client, routine({ hevy: first.link }));
		expect(second.folderCreated).toBe(true);
		expect(second.created).toEqual(["Upper"]);
		expect(second.updated).toEqual(["Lower"]);
		// Every day ends up in the new folder, including the one only updated.
		for (const id of Object.values(second.link.dayRoutineIds)) {
			expect(hevy.routines.get(id)!.folderId).toBe(second.link.folderId);
		}
	});

	it("skips empty days and reports routines for removed days", async () => {
		const hevy = fakeHevy();
		const first = await push(hevy.client, routine());
		const edited = routine({ hevy: first.link });
		edited.days = [{ ...edited.days[0] }, { id: "d3", name: "Rest", exercises: [] }];

		const second = await push(hevy.client, edited);
		expect(second.skipped).toEqual(["Rest"]);
		expect(second.orphanedRoutineIds).toEqual([first.link.dayRoutineIds.d2]);
		expect(second.link.dayRoutineIds).toEqual({ d1: first.link.dayRoutineIds.d1 });
	});

	it("remembers what was pushed before a failure, so retrying makes no duplicates", async () => {
		// Writes: folder, Upper, then Lower fails.
		const hevy = fakeHevy({ failOn: 3 });
		const links: HevyLink[] = [];
		await expect(push(hevy.client, routine(), links)).rejects.toThrow("Hevy is down");
		const saved = links.at(-1)!;
		expect(Object.keys(saved.dayRoutineIds)).toEqual(["d1"]);

		const retry = await push(hevy.client, routine({ hevy: saved }));
		expect(retry.folderCreated).toBe(false);
		expect(retry.updated).toEqual(["Upper"]);
		expect(retry.created).toEqual(["Lower"]);
		expect(hevy.folders.size).toBe(1);
		expect(hevy.routines.size).toBe(2);
	});
});

describe("resolving exercises", () => {
	it("finds exercises the account lacks and swaps them everywhere", () => {
		const r = routine();
		r.days[1].exercises.push({ exerciseId: "ex57", sets: 3 });
		expect(findUnresolvedExercises(r, new Set([BENCH, LATERAL]))).toEqual(["ex57"]);

		const swapped = replaceExercise(r, "ex57", "custom-uuid");
		expect(swapped.days[1].exercises[1]).toEqual({ exerciseId: "custom-uuid", sets: 3 });
		expect(findUnresolvedExercises(swapped, new Set([BENCH, LATERAL, "custom-uuid"]))).toEqual([]);
	});
});
