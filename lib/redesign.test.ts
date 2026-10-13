import { describe, expect, it } from "vitest";
import { buildCatalog } from "./exercise-catalog";
import { analyzePriorities } from "./priority-analysis";
import { diffRoutine } from "./routine-diff";
import { decodeRoutine, encodeRoutine } from "./share";
import { buildSuggestions, STAPLES } from "./suggestions";
import { searchExercises } from "./search";
import { TEMPLATES, routineFromTemplate } from "./templates";
import landmarks from "@/data/volume-landmarks.json";
import type { Routine, VolumeLandmarks } from "./types";
import { calculateMuscleVolumes } from "./volume-calculator";

const exercises = buildCatalog({});
const byId = new Map(exercises.map((e) => [e.id, e]));
const getExercise = (id: string) => byId.get(id);

const routine = (): Routine => ({
	id: "r",
	name: "Test",
	days: [
		{ id: "d1", name: "Push", exercises: [{ exerciseId: "79D0BB3A", sets: 3 }, { exerciseId: "422B08F1", sets: 3 }] },
		{ id: "d2", name: "Pull", exercises: [{ exerciseId: "1B2B1E7C", sets: 3 }] },
	],
});

describe("diffRoutine", () => {
	it("marks added, changed and removed exercises and days; reordering alone is not a change", () => {
		const base = routine();
		const draft = routine();
		draft.days[0].exercises = [
			{ exerciseId: "422B08F1", sets: 4 }, // moved and changed
			{ exerciseId: "79D0BB3A", sets: 3 }, // moved only
			{ exerciseId: "37FCC2BB", sets: 2 }, // added
		];
		draft.days.splice(1, 1); // Pull removed
		draft.days.push({ id: "d3", name: "Legs", exercises: [{ exerciseId: "D04AC939", sets: 3 }] });

		const diff = diffRoutine(base, draft);
		expect([...diff.days.get("d1")!.exercises]).toEqual([
			[0, "changed"],
			[2, "added"],
		]);
		expect(diff.days.get("d3")).toMatchObject({ added: true });
		expect(diff.removedDays.map((d) => d.name)).toEqual(["Pull"]);
		expect(diff.count).toBe(4);
	});

	it("reports nothing for identical routines", () => {
		expect(diffRoutine(routine(), routine()).count).toBe(0);
	});
});

describe("share links", () => {
	it("round-trips a routine, dropping exercises the recipient can't have", async () => {
		const r = routine();
		r.days[0].exercises[0] = { exerciseId: "79D0BB3A", sets: 4, reps: { min: 5, max: 8 }, restSeconds: 180, notes: "Pause" };
		r.days[1].exercises.push({ exerciseId: "4fd4dc67-8bee-4e4e-8da2-cb61d8f0e9a9", sets: 2 });
		const { code, skipped } = await encodeRoutine(r);
		expect(skipped).toBe(1);
		expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
		const back = await decodeRoutine(code);
		expect(back.name).toBe("Test");
		expect(back.days.map((d) => d.name)).toEqual(["Push", "Pull"]);
		expect(back.days[0].exercises[0]).toEqual({
			exerciseId: "79D0BB3A",
			sets: 4,
			reps: { min: 5, max: 8 },
			restSeconds: 180,
			notes: "Pause",
		});
		expect(back.days[1].exercises).toEqual([{ exerciseId: "1B2B1E7C", sets: 3 }]);
	});

	it("keeps a full template link short", async () => {
		const { code } = await encodeRoutine(routineFromTemplate(TEMPLATES[1]));
		expect(code.length).toBeLessThan(500);
	});

	it("rejects garbage", async () => {
		await expect(decodeRoutine("not!valid")).rejects.toThrow();
		await expect(decodeRoutine("AAAA")).rejects.toThrow(/damaged/);
	});
});

describe("templates", () => {
	it("land every major muscle between MEV and MRV", () => {
		// Muscles that usually get enough from compound lifts (front delts from
		// pressing) or are low priority for most people; only the MRV cap applies.
		const minor = new Set(["Forearms", "Neck", "Abductors", "Adductors", "Traps", "Lower Back", "Abs", "Calves", "Front Delts"]);
		for (const t of TEMPLATES) {
			for (const v of calculateMuscleVolumes(routineFromTemplate(t), exercises)) {
				const l = (landmarks as VolumeLandmarks)[v.muscle];
				if (!l) continue;
				expect(v.totalSets, `${t.id} ${v.muscle}`).toBeLessThanOrEqual(l.mrv);
				if (!minor.has(v.muscle)) expect(v.totalSets, `${t.id} ${v.muscle}`).toBeGreaterThanOrEqual(l.mev);
			}
		}
	});

	it("only use exercises that exist", () => {
		for (const t of TEMPLATES) {
			for (const [, exs] of t.days) for (const [id] of exs) expect(getExercise(id), `${t.id} ${id}`).toBeDefined();
			expect(t.days.length).toBe(t.daysPerWeek);
		}
	});
});

describe("suggestions", () => {
	it("suggests direct work for under-target priorities on a day that doesn't train them yet", () => {
		const r = routine();
		const volumes = calculateMuscleVolumes(r, exercises);
		const results = analyzePriorities(volumes, { S: ["Side Delts"], A: ["Chest"] });
		const [first] = buildSuggestions(results, r, exercises, getExercise);
		expect(first.muscle).toBe("Side Delts");
		// Already in the routine, so not suggested again.
		expect(first.exercises.map((e) => e.id)).not.toContain("422B08F1");
		expect(first.exercises.every((e) => e.muscle_weightings[0].muscle === "Side Delts")).toBe(true);
		expect(first.dayId).toBe("d2");
		expect(first.sets).toBeLessThanOrEqual(4);
	});
});

describe("staples", () => {
	it("each train the muscle they're listed under as its main muscle", () => {
		for (const [muscle, ids] of Object.entries(STAPLES)) {
			for (const id of ids) {
				const main = getExercise(id)?.muscle_weightings[0];
				expect(main, `${muscle} ${id}`).toMatchObject({ muscle, weighting: 1 });
			}
		}
	});
});

describe("searchExercises", () => {
	it("ranks names that start with the query first", () => {
		expect(searchExercises(exercises, "lateral").slice(0, 3).map((e) => e.name)).not.toContain("Iso-Lateral Row (Machine)");
		expect(searchExercises(exercises, "lateral raise")[0].name).toMatch(/^Lateral Raise/);
		expect(searchExercises(exercises, "bench")[0].name).toMatch(/^Bench Press/);
	});
});
