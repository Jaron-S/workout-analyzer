import { describe, expect, it } from "vitest";
import { buildCatalog } from "../exercise-catalog";
import { DEFAULT_TRAINING_DEFAULTS, inferDefaultsFromRoutines } from "../training-defaults";
import type { HevyExerciseTemplate, HevyRoutine } from "./client";
import {
	customTemplateToExercise,
	estimateWeightings,
	normalizeExerciseName,
	toCustomExerciseInput,
} from "./exercises";

const template = (overrides: Partial<HevyExerciseTemplate>): HevyExerciseTemplate => ({
	id: "uuid",
	title: "Custom",
	type: "weight_reps",
	primary_muscle_group: "chest",
	secondary_muscle_groups: [],
	equipment: "dumbbell",
	is_custom: true,
	thumbnail_url: null,
	...overrides,
});

describe("estimateWeightings", () => {
	it("maps Hevy muscle groups, splitting shoulders by exercise name", () => {
		expect(
			estimateWeightings(
				template({
					title: "Super ROM Lateral Raises",
					primary_muscle_group: "shoulders",
					secondary_muscle_groups: ["traps", "upper_back"],
				})
			)
		).toEqual([
			{ muscle: "Side Delts", weighting: 1 },
			{ muscle: "Traps", weighting: 0.5 },
			{ muscle: "Middle Back", weighting: 0.5 },
		]);
		expect(
			estimateWeightings(template({ title: "Lying Side Raise", primary_muscle_group: "shoulders" }))[0]
				.muscle
		).toBe("Side Delts");
		expect(estimateWeightings(template({ primary_muscle_group: "cardio" }))).toEqual([]);
	});

	it("marks custom exercises as estimated", () => {
		const exercise = customTemplateToExercise(template({}));
		expect(exercise).toMatchObject({ hevyCustom: true, estimatedWeightings: true });
	});
});

describe("normalizeExerciseName", () => {
	it("matches the old app names to the user's Hevy customs", () => {
		expect(normalizeExerciseName("Super ROM Lateral Raise")).toBe(
			normalizeExerciseName("Super ROM Lateral Raises")
		);
		expect(normalizeExerciseName("Reverse Nordic Curl")).toBe(
			normalizeExerciseName("Reverse Nordic Curl")
		);
		expect(normalizeExerciseName("Candlestick")).not.toBe(
			normalizeExerciseName("Modified Candlestick")
		);
	});
});

describe("toCustomExerciseInput", () => {
	it("maps app muscles to Hevy muscle groups without duplicates", () => {
		const legacy = buildCatalog({}).find((e) => e.id === "ex73")!; // Windshield Wipers
		const input = toCustomExerciseInput(
			{ ...legacy, muscle_weightings: [
				{ muscle: "Side Delts", weighting: 1 },
				{ muscle: "Rear Delts", weighting: 0.5 },
				{ muscle: "Traps", weighting: 0.3 },
			] },
			"dumbbell"
		);
		expect(input).toEqual({
			title: "Windshield Wipers",
			exercise_type: "weight_reps",
			equipment_category: "dumbbell",
			muscle_group: "shoulders",
			other_muscles: ["traps"],
		});
	});
});

describe("inferDefaultsFromRoutines", () => {
	it("uses the median rest and the middle of the rep targets per kind", () => {
		const catalog = new Map(buildCatalog({}).map((e) => [e.id, e]));
		const exercise = (id: string, rest: number, reps: number) => ({
			exercise_template_id: id,
			title: "",
			superset_id: null,
			notes: null,
			rest_seconds: rest,
			sets: [
				{ type: "normal" as const, reps, weight_kg: null, distance_meters: null, duration_seconds: null },
			],
		});
		const routines = [
			{
				id: "r",
				title: "r",
				folder_id: null,
				exercises: [
					...[180, 180, 180, 120, 240].map((rest, i) => exercise("79D0BB3A", rest, 5 + i)),
					// Only 2 isolation samples: too few, so the default stays.
					exercise("422B08F1", 60, 15),
					exercise("422B08F1", 60, 15),
				],
			},
		] as HevyRoutine[];

		const inferred = inferDefaultsFromRoutines(routines, (id) => catalog.get(id), DEFAULT_TRAINING_DEFAULTS);
		expect(inferred.restSeconds.compound).toBe(180);
		expect(inferred.reps.compound).toEqual({ min: 6, max: 8 });
		expect(inferred.restSeconds.isolation).toBe(DEFAULT_TRAINING_DEFAULTS.restSeconds.isolation);
		expect(inferred.reps.isolation).toEqual(DEFAULT_TRAINING_DEFAULTS.reps.isolation);
	});
});
