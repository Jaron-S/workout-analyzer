import { describe, expect, it } from "vitest";
import hevyRoutines from "./__fixtures__/hevy-routines.json";
import { buildCatalog } from "./exercise-catalog";
import type { HevyRoutine } from "./hevy/client";
import { routineFromHevy } from "./hevy/import";
import { matchExercise, parseRoutineText } from "./import-text";

const exercises = buildCatalog({});
const name = (text: string) => matchExercise(text, exercises).match?.name;

describe("matchExercise", () => {
	it("matches common names and gym shorthand", () => {
		expect(name("Bench press")).toBe("Bench Press (Barbell)");
		expect(name("Incline DB press")).toBe("Incline Bench Press (Dumbbell)");
		expect(name("RDLs")).toBe("Romanian Deadlift (Barbell)");
		expect(name("Lat pulldowns")).toBe("Lat Pulldown (Cable)");
		expect(name("Lateral raises")).toBe("Lateral Raise (Dumbbell)");
		expect(name("Skull crushers")).toMatch(/^Skullcrusher/);
		expect(name("Pull-ups")).toBe("Pull Up");
		expect(name("Leg press")).toBe("Leg Press (Machine)");
		expect(name("OHP")).toMatch(/^Overhead Press/);
		expect(name("Wide grip lat pulldowns")).toBe("Lat Pulldown (Cable)");
		expect(name("Close grip bench")).toBe("Bench Press - Close Grip (Barbell)");
	});

	it("doesn't force a match on nonsense", () => {
		expect(matchExercise("stretch and foam roll the hip flexors", exercises).match?.name ?? "").not.toMatch(/Bench/);
		expect(matchExercise("zzz", exercises).match).toBeNull();
	});
});

describe("parseRoutineText", () => {
	it("reads days, exercises, sets and rep ranges from typical notes", () => {
		const days = parseRoutineText(
			`Push day:
1. Bench press 4x6-8
2. Incline DB press 3 x 8-10
- Lateral raises 4×15
Tricep pushdowns 3 sets of 12

PULL
Pull-ups 3x8
Barbell rows 3x8-10
Face pulls - 3 x 15
EZ bar curls 3x10`,
			exercises
		);
		expect(days.map((d) => d.name)).toEqual(["Push day", "PULL"]);
		expect(days[0].lines.map((l) => [l.match?.name, l.sets, l.reps])).toEqual([
			["Bench Press (Barbell)", 4, { min: 6, max: 8 }],
			["Incline Bench Press (Dumbbell)", 3, { min: 8, max: 10 }],
			["Lateral Raise (Dumbbell)", 4, { min: 15, max: 15 }],
			["Triceps Pushdown", 3, { min: 12, max: 12 }],
		]);
		expect(days[1].lines.map((l) => l.match?.name)).toEqual([
			"Pull Up",
			"Bent Over Row (Barbell)",
			"Face Pull",
			"EZ Bar Biceps Curl",
		]);
	});

	it("keeps unmatched exercises so they can be fixed, and defaults to 3 sets", () => {
		const [day] = parseRoutineText("Monday\nZercher good morning thing 3x8\nLeg press", exercises);
		expect(day.name).toBe("Monday");
		expect(day.lines.at(-1)).toMatchObject({ name: "Leg press", sets: 3 });
	});
});

describe("routineFromHevy", () => {
	it("turns real Hevy routines into linked days", () => {
		const routines = hevyRoutines as unknown as HevyRoutine[];
		const routine = routineFromHevy("Upper/Lower", routines, routines[0].folder_id);
		expect(routine.days.map((d) => d.name)).toEqual(routines.map((r) => r.title));
		expect(routine.days[0].exercises.length).toBe(routines[0].exercises.length);
		const first = routines[0].exercises[0];
		expect(routine.days[0].exercises[0]).toMatchObject({
			exerciseId: first.exercise_template_id,
			sets: first.sets.filter((s) => s.type !== "warmup").length || first.sets.length,
		});
		// Linked, so pushing updates these Hevy routines instead of copying them.
		expect(Object.values(routine.hevy!.dayRoutineIds)).toEqual(routines.map((r) => r.id));
		expect(routine.hevy!.folderId).toBe(routines[0].folder_id);
	});
});
