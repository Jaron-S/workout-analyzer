// How good each exercise is for each muscle, from Jeff Nippard's tier lists
// (data/exercise-rankings.json), and the order exercises are picked in once
// the user's favourites and exercises to avoid are taken into account.

import rankingsData from "@/data/exercise-rankings.json";
import { STAPLES } from "./staples";
import type { Exercise, ExercisePreferences } from "./types";

export type ExerciseTier = "S+" | "S" | "A" | "B" | "C" | "D" | "F";
export const EXERCISE_TIERS: ExerciseTier[] = ["S+", "S", "A", "B", "C", "D", "F"];

export interface RankingEntry {
	/** The exercise as the tier list names it. */
	name: string;
	tier: ExerciseTier;
	/** The muscles the tier applies to. */
	muscles: string[];
	/** Hevy exercises it maps to; empty when Hevy has no such exercise. */
	hevyIds: string[];
	/** The tier list's comment, e.g. "Upper Glute #1 Choice". */
	note?: string;
	/** The tier only holds when done this way (e.g. deficit push-ups), not for every set of the Hevy exercise. */
	variation?: boolean;
	cues?: { setup?: string; execution?: string };
}

export const RANKINGS = rankingsData.rankings as RankingEntry[];

/** An exercise's standing for one muscle. */
export interface ExerciseRank {
	muscle: string;
	tier: ExerciseTier;
	/** The entry that sets the tier. */
	entry: RankingEntry;
	/** Better-ranked ways to do the same exercise, e.g. lean-in lateral raises. */
	better: RankingEntry[];
	/** Every entry for this exercise and muscle, best first. */
	entries: RankingEntry[];
}

export const tierIndex = (tier: ExerciseTier) => EXERCISE_TIERS.indexOf(tier);
const byTier = (a: RankingEntry, b: RankingEntry) => tierIndex(a.tier) - tierIndex(b.tier);

/** For comparing names: ignores case, punctuation, brackets and a plural "s". */
const normalise = (name: string) =>
	name
		.toLowerCase()
		.replace(/\(.*?\)/g, "")
		.replace(/[^a-z0-9]+/g, "")
		.replace(/s$/, "");

const words = (name: string) =>
	new Set(
		name
			.toLowerCase()
			.split(/[^a-z0-9]+/)
			.filter(Boolean)
			.map((w) => w.replace(/s$/, ""))
	);

/** False when the tier list's name says nothing the exercise's doesn't ("Hack Squat" for "Hack Squat (Machine)"). */
export function namedDifferently(entry: RankingEntry, exerciseName: string): boolean {
	const own = words(exerciseName);
	return [...words(entry.name)].some((w) => !own.has(w));
}

export interface Rankings {
	/** The exercise's tier for each muscle it's ranked for, best first. */
	forExercise(id: string): ExerciseRank[];
	forMuscle(id: string, muscle: string): ExerciseRank | undefined;
	/** The best tier across muscles, for a compact badge. */
	best(id: string): ExerciseRank | undefined;
	/** Ranked entries for a muscle, best first, with the exercises they map to (Hevy's, or the user's custom ones). */
	entriesFor(muscle: string): { entry: RankingEntry; ids: string[] }[];
	/** Muscles that have a tier list. */
	muscles: string[];
}

function build(exercises: Exercise[]): Rankings {
	// Entries Hevy has no exercise for can still match one of the user's own
	// custom exercises by name.
	const customByName = new Map(exercises.filter((e) => e.hevyCustom).map((e) => [normalise(e.name), e.id]));
	const idsOf = (entry: RankingEntry) => {
		if (entry.hevyIds.length) return entry.hevyIds;
		const custom = customByName.get(normalise(entry.name));
		return custom ? [custom] : [];
	};

	const byExercise = new Map<string, Map<string, RankingEntry[]>>();
	for (const entry of RANKINGS) {
		for (const id of idsOf(entry)) {
			const muscles = byExercise.get(id) ?? new Map<string, RankingEntry[]>();
			for (const muscle of entry.muscles) muscles.set(muscle, [...(muscles.get(muscle) ?? []), entry]);
			byExercise.set(id, muscles);
		}
	}

	const ranks = new Map<string, ExerciseRank[]>();
	for (const [id, muscles] of byExercise) {
		const list: ExerciseRank[] = [];
		for (const [muscle, entries] of muscles) {
			const sorted = [...entries].sort(byTier);
			// The plain exercise's tier when the list ranks it; a variation's
			// only when that's the sole way the list mentions it.
			const entry = sorted.find((e) => !e.variation) ?? sorted[0];
			const better = sorted.filter((e) => e !== entry && tierIndex(e.tier) < tierIndex(entry.tier));
			list.push({ muscle, tier: entry.tier, entry, better, entries: sorted });
		}
		ranks.set(
			id,
			list.sort((a, b) => tierIndex(a.tier) - tierIndex(b.tier))
		);
	}

	const muscles = [...new Set(RANKINGS.flatMap((e) => e.muscles))];
	return {
		forExercise: (id) => ranks.get(id) ?? [],
		forMuscle: (id, muscle) => ranks.get(id)?.find((r) => r.muscle === muscle),
		best: (id) => ranks.get(id)?.[0],
		entriesFor: (muscle) =>
			RANKINGS.filter((e) => e.muscles.includes(muscle))
				.sort(byTier)
				.map((entry) => ({ entry, ids: idsOf(entry) })),
		muscles,
	};
}

const cache = new WeakMap<Exercise[], Rankings>();

/** Rankings for this exercise list (built once per list). */
export function rankingsFor(exercises: Exercise[]): Rankings {
	let rankings = cache.get(exercises);
	if (!rankings) {
		rankings = build(exercises);
		cache.set(exercises, rankings);
	}
	return rankings;
}

/**
 * Where an exercise comes when picking work for a muscle; lower is better,
 * null means don't pick it. Favourites lead, then S+ to B, then the app's
 * staples, then C, then everything else. Avoided, D and F exercises are
 * never picked (a favourite D still is: it's the user's call).
 */
export function pickOrder(
	exercise: Exercise,
	muscle: string,
	rankings: Rankings,
	preferences: ExercisePreferences = {}
): number | null {
	const pref = preferences[exercise.id]?.pref;
	if (pref === "avoid") return null;
	const rank = rankings.forMuscle(exercise.id, muscle);
	const tier = rank ? tierIndex(rank.tier) : null;
	const staple = (STAPLES[muscle] ?? []).indexOf(exercise.id);
	// Without a tier: staples just below B, the user's customs, then the rest.
	const base =
		tier !== null
			? tier <= tierIndex("B")
				? tier * 10
				: tier === tierIndex("C")
					? 50
					: null
			: staple !== -1
				? 40 + staple
				: exercise.hevyCustom
					? 100
					: 200;
	if (pref === "favourite") return -100 + (tier ?? 5);
	return base;
}

/** For lists that show everything: best picks first, then D and F, then avoided exercises. */
export function browseOrder(
	exercise: Exercise,
	muscle: string,
	rankings: Rankings,
	preferences: ExercisePreferences = {}
): number {
	if (preferences[exercise.id]?.pref === "avoid") return 2000;
	return pickOrder(exercise, muscle, rankings, preferences) ?? 1000 + tierIndex(rankings.forMuscle(exercise.id, muscle)?.tier ?? "F");
}
