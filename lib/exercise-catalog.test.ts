import legacyExercises from "@/data/legacy-exercises.json";
import legacyExerciseMap from "@/data/legacy-exercise-map.json";
import { describe, expect, it } from "vitest";
import { buildCatalog, getDefaultWeightings, migrateRoutine } from "./exercise-catalog";
import type { Routine } from "./types";
import { calculateMuscleVolumes } from "./volume-calculator";

const oldRoutine: Routine = {
	id: "r1",
	name: "Old routine",
	days: [
		{
			id: "day-1",
			name: "Push",
			exercises: [
				{ exerciseId: "ex1", sets: 4 }, // Bench Press
				{ exerciseId: "ex57", sets: 3 }, // Donkey Calf Raises: no Hevy built-in
			],
		},
	],
};

describe("migrateRoutine", () => {
	it("converts old IDs to Hevy IDs and keeps unmatched ones", () => {
		const migrated = migrateRoutine(oldRoutine);
		expect(migrated.days[0].exercises).toEqual([
			{ exerciseId: "79D0BB3A", sets: 4 },
			{ exerciseId: "ex57", sets: 3 },
		]);
	});

	it("is a no-op on an already-converted routine", () => {
		const once = migrateRoutine(oldRoutine);
		expect(migrateRoutine(once)).toBe(once);
	});

	it("resolves every one of the 134 old exercise IDs", () => {
		const catalog = new Map(buildCatalog({}).map((e) => [e.id, e]));
		const oldIds = [
			...Object.keys(legacyExerciseMap),
			...legacyExercises.map((e) => e.id),
		];
		expect(new Set(oldIds).size).toBe(134);
		for (const id of oldIds) {
			const routine = migrateRoutine({
				id: "r",
				name: "r",
				days: [{ id: "d", name: "d", exercises: [{ exerciseId: id, sets: 1 }] }],
			});
			expect(catalog.has(routine.days[0].exercises[0].exerciseId), id).toBe(true);
		}
	});
});

describe("buildCatalog", () => {
	it("applies a user's muscle weightings and can restore the defaults", () => {
		// Romanian Deadlift (Barbell), for someone who feels it mostly in glutes.
		const rdl = "2B4B7310";
		const custom = buildCatalog({ [rdl]: { Glutes: 1, Hamstrings: 0.3 } }).find(
			(e) => e.id === rdl
		)!;
		expect(custom.customWeightings).toBe(true);
		expect(custom.muscle_weightings).toEqual([
			{ muscle: "Glutes", weighting: 1 },
			{ muscle: "Hamstrings", weighting: 0.3 },
		]);

		const defaults = buildCatalog({}).find((e) => e.id === rdl)!;
		expect(defaults.customWeightings).toBeUndefined();
		expect(defaults.muscle_weightings).toEqual(getDefaultWeightings(rdl));
	});

	it("feeds the volume analysis for migrated routines", () => {
		const volumes = calculateMuscleVolumes(migrateRoutine(oldRoutine), buildCatalog({}));
		const sets = (muscle: string) => volumes.find((v) => v.muscle === muscle)?.totalSets;
		expect(sets("Chest")).toBe(4);
		expect(sets("Calves")).toBe(3);
	});
});
