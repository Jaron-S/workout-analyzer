import { describe, expect, it } from "vitest";
import landmarks from "@/data/volume-landmarks.json";
import { buildCatalog } from "./exercise-catalog";
import { EXERCISE_TIERS, RANKINGS, pickOrder, rankingsFor } from "./exercise-rankings";
import { exercisesFor } from "./suggestions";
import type { Exercise } from "./types";

const exercises = buildCatalog({});
const byId = new Map(exercises.map((e) => [e.id, e]));
const rankings = rankingsFor(exercises);

describe("exercise rankings data", () => {
	it("maps to real exercises, muscles and tiers", () => {
		for (const entry of RANKINGS) {
			expect(EXERCISE_TIERS, entry.name).toContain(entry.tier);
			for (const m of entry.muscles) expect(Object.keys(landmarks), entry.name).toContain(m);
			for (const id of entry.hevyIds) expect(byId.get(id), `${entry.name} ${id}`).toBeDefined();
		}
	});
});

describe("rankings", () => {
	it("uses the plain exercise's tier and lists better variations", () => {
		const pushUp = rankings.forMuscle("392887AA", "Chest")!;
		expect(pushUp.tier).toBe("C");
		expect(pushUp.better.map((b) => `${b.name} ${b.tier}`)).toEqual(["Deficit Push-Ups A", "Banded Push-Ups B"]);
	});

	it("uses a variation's tier when that's the only way the list ranks it", () => {
		expect(rankings.forMuscle("12017185", "Chest")?.tier).toBe("A");
	});

	it("ranks one exercise differently per muscle", () => {
		expect(rankings.forMuscle("BE640BA0", "Rear Delts")?.tier).toBe("A");
		expect(rankings.forMuscle("BE640BA0", "Middle Back")?.tier).toBe("B");
		expect(rankings.forMuscle("67280085", "Lats")?.tier).toBe("S");
		expect(rankings.forMuscle("67280085", "Chest")?.tier).toBe("D");
	});

	it("averages sources, leaning to the first on a tie, and flags big splits", () => {
		const dips = rankings.forMuscle("6FCD7755", "Chest")!;
		expect(dips.opinions.map((o) => `${o.source} ${o.tier}`)).toEqual(["Jeff Nippard A", "Mike Israetel / Milo Wolf C"]);
		expect(dips.tier).toBe("B");
		expect(dips.disagree).toBe(true);
		// Nippard S+, Israetel/Wolf S: halfway, so Nippard's side.
		expect(rankings.forMuscle("B5EFBF9C", "Triceps")?.tier).toBe("S+");
		expect(rankings.forMuscle("B5EFBF9C", "Triceps")?.disagree).toBe(false);
	});

	it("compares variations with variations", () => {
		// Plain push-ups are only Nippard's C; both lists' deficit push-ups (A, S) merge.
		const pushUp = rankings.forMuscle("392887AA", "Chest")!;
		expect(pushUp.opinions.map((o) => o.source)).toEqual(["Jeff Nippard"]);
		expect(pushUp.better.filter((b) => b.name === "Deficit Push-Ups").map((b) => b.tier)).toEqual(["A"]);
	});

	it("lets the dedicated rear delt list replace the shoulder list's", () => {
		const machine = rankings.forMuscle("D8281C62", "Rear Delts")!;
		expect(machine.tier).toBe("B");
		expect(machine.entry.listedAs).toBe("Low B");
		expect(machine.better.map((b) => `${b.name} ${b.tier}`)).toEqual(["Reverse Pec Deck (Sideways Setup) S"]);
	});

	it("records whose list a tier is from", () => {
		expect(rankings.forMuscle("23A48484", "Abs")?.entry.source).toBe("Jeremy Ethier");
		expect(rankings.forMuscle("E05C2C38", "Calves")?.entry.source).toBe("Setsmith estimate");
		expect(rankings.forMuscle("1E42FD5F", "Quads")?.entry.source).toBeUndefined();
	});

	it("matches entries Hevy lacks to the user's custom exercises by name", () => {
		const katana: Exercise = { id: "custom-1", name: "Katana Triceps Extensions (Cable)", hevyCustom: true, muscle_weightings: [{ muscle: "Triceps", weighting: 1 }] };
		const withCustom = rankingsFor([...exercises, katana]);
		expect(withCustom.forMuscle("custom-1", "Triceps")?.tier).toBe("A");
		expect(rankings.forMuscle("custom-1", "Triceps")).toBeUndefined();
	});
});

describe("picking exercises", () => {
	it("leads with S+ and never picks D or F", () => {
		const quads = exercisesFor("Quads", exercises, new Set());
		expect(quads[0].id).toBe("1E42FD5F");
		expect(quads.map((e) => e.id)).not.toContain("70D4EBBF");
		expect(pickOrder(byId.get("70D4EBBF")!, "Quads", rankings)).toBeNull();
	});

	it("puts favourites first and drops avoided exercises", () => {
		const preferences = { C7973E0E: { pref: "favourite" as const }, "1E42FD5F": { pref: "avoid" as const, note: "no machine" } };
		const quads = exercisesFor("Quads", exercises, new Set(), preferences).map((e) => e.id);
		expect(quads[0]).toBe("C7973E0E");
		expect(quads).not.toContain("1E42FD5F");
	});
});
