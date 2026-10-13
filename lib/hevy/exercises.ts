import type { Exercise, MuscleWeighting } from "../types";
import type { HevyCustomExerciseInput, HevyExerciseTemplate } from "./client";

// Hevy muscle group -> app muscle. "shoulders" is split by exercise name
// (see deltFor); cardio, full_body and other add no muscle volume.
const FROM_HEVY: Record<string, string> = {
	abdominals: "Abs",
	abductors: "Abductors",
	adductors: "Adductors",
	biceps: "Biceps",
	calves: "Calves",
	chest: "Chest",
	forearms: "Forearms",
	glutes: "Glutes",
	hamstrings: "Hamstrings",
	lats: "Lats",
	lower_back: "Lower Back",
	neck: "Neck",
	quadriceps: "Quads",
	traps: "Traps",
	triceps: "Triceps",
	upper_back: "Middle Back",
};

const TO_HEVY: Record<string, string> = {
	...Object.fromEntries(Object.entries(FROM_HEVY).map(([hevy, app]) => [app, hevy])),
	"Front Delts": "shoulders",
	"Side Delts": "shoulders",
	"Rear Delts": "shoulders",
};

const SECONDARY_WEIGHTING = 0.5;

function deltFor(title: string): string {
	if (/lateral|side|upright|y raise/i.test(title)) return "Side Delts";
	if (/rear|reverse fly|face pull|pull ?apart/i.test(title)) return "Rear Delts";
	return "Front Delts";
}

const toAppMuscle = (group: string, title: string) =>
	group === "shoulders" ? deltFor(title) : FROM_HEVY[group];

/**
 * Guesses weightings for an exercise from Hevy's muscle groups: the primary
 * muscle counts fully and each secondary one as half a set.
 */
export function estimateWeightings(template: HevyExerciseTemplate): MuscleWeighting[] {
	const primary = toAppMuscle(template.primary_muscle_group, template.title);
	if (!primary) return [];
	const weightings = [{ muscle: primary, weighting: 1 }];
	for (const group of template.secondary_muscle_groups) {
		const muscle = toAppMuscle(group, template.title);
		if (muscle && !weightings.some((w) => w.muscle === muscle)) {
			weightings.push({ muscle, weighting: SECONDARY_WEIGHTING });
		}
	}
	return weightings;
}

export function customTemplateToExercise(template: HevyExerciseTemplate): Exercise {
	const muscle_weightings = estimateWeightings(template);
	return {
		id: template.id,
		name: template.title,
		type: template.type,
		equipment: template.equipment,
		thumbnailUrl: template.thumbnail_url,
		muscle_weightings,
		compound: muscle_weightings.length >= 3,
		hevyCustom: true,
		estimatedWeightings: muscle_weightings.length > 0,
	};
}

/** Lower-case, without punctuation, bracketed equipment or a plural "s". */
export function normalizeExerciseName(name: string): string {
	return name
		.toLowerCase()
		.replace(/\(.*?\)/g, " ")
		.replace(/[^a-z0-9]+/g, " ")
		.split(" ")
		.filter(Boolean)
		.map((word) => (word.length > 3 ? word.replace(/s$/, "") : word))
		.join(" ");
}

export const HEVY_EQUIPMENT = [
	"none",
	"barbell",
	"dumbbell",
	"kettlebell",
	"machine",
	"plate",
	"resistance_band",
	"suspension",
	"other",
] as const;

export function guessEquipment(name: string): (typeof HEVY_EQUIPMENT)[number] {
	const n = name.toLowerCase();
	if (n.includes("barbell")) return "barbell";
	if (n.includes("dumbbell")) return "dumbbell";
	if (n.includes("kettlebell")) return "kettlebell";
	if (n.includes("cable") || n.includes("machine")) return "machine";
	if (n.includes("band")) return "resistance_band";
	return "none";
}

/** The request for creating an exercise as a Hevy custom exercise. */
export function toCustomExerciseInput(
	exercise: Exercise,
	equipment: string
): HevyCustomExerciseInput {
	const groups = exercise.muscle_weightings
		.map((w) => TO_HEVY[w.muscle])
		.filter((g): g is string => Boolean(g));
	const [primary = "other", ...rest] = groups;
	return {
		title: exercise.name,
		exercise_type: exercise.type ?? (equipment === "none" ? "reps_only" : "weight_reps"),
		equipment_category: equipment,
		muscle_group: primary,
		other_muscles: [...new Set(rest)].filter((g) => g !== primary),
	};
}
