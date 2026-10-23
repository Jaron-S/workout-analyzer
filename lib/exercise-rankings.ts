// How good each exercise is for each muscle, from YouTube tier lists (Jeff
// Nippard's, Jeremy Ethier's for abs, Mike Israetel and Milo Wolf's),
// averaged where they overlap, plus a few estimates
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
	/** Whose list it's from; Jeff Nippard's when absent. "Setsmith estimate" for ones no list covers. */
	source?: string;
	/** The list's own label when finer than the tier, e.g. "High A". */
	listedAs?: string;
}

const DEFAULT_SOURCE = "Jeff Nippard";
/** Whose rating it is, e.g. "Jeff Nippard" or "Setsmith estimate". */
export const sourceOf = (entry: RankingEntry) => entry.source ?? DEFAULT_SOURCE;

export const RANKINGS = rankingsData.rankings as RankingEntry[];

/** "Nippard", "Israetel/Wolf", "estimate": short enough for a row. */
export const shortSource = (source: string) =>
	source === "Setsmith estimate"
		? "estimate"
		: source
				.split(" / ")
				.map((name) => name.split(" ").at(-1))
				.join("/");

/** "Nippard A · Israetel/Wolf C, experts disagree" */
export const describeOpinions = (rank: ExerciseRank) =>
	`${rank.opinions.map((o) => `${shortSource(o.source)} ${o.tier}`).join(" · ")}${rank.disagree ? ", experts disagree" : ""}`;

/** One source's rating of an exercise for a muscle. */
export interface Opinion {
	source: string;
	tier: ExerciseTier;
	entry: RankingEntry;
}

/** An exercise's standing for one muscle. */
export interface ExerciseRank {
	muscle: string;
	/** The sources' average (see combine). */
	tier: ExerciseTier;
	/** The first source's entry: its name and notes describe the exercise. */
	entry: RankingEntry;
	/** Each source's rating, in the order the sources first appear. */
	opinions: Opinion[];
	/** The sources are two or more tiers apart. */
	disagree: boolean;
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

/** A row of a muscle's tier list. Without an id, the entry matches no exercise (not in Hevy). */
export interface MuscleRow {
	tier: ExerciseTier;
	entry: RankingEntry;
	id?: string;
	rank?: ExerciseRank;
}

// Sources in the order they first appear; on a tie the earliest decides.
const SOURCE_ORDER = [...new Set(RANKINGS.map(sourceOf))];

/**
 * Each source's rating. Plain versions are compared with plain versions: a
 * source's rating is its best plain entry, and variations count only when no
 * source ranks the plain exercise (deficit push-ups aren't push-ups).
 */
function combine(entries: RankingEntry[]): Opinion[] {
	const plain = entries.filter((e) => !e.variation);
	const pool = plain.length ? plain : entries;
	const bySource = new Map<string, RankingEntry>();
	for (const entry of pool) {
		const best = bySource.get(sourceOf(entry));
		if (!best || tierIndex(entry.tier) < tierIndex(best.tier)) bySource.set(sourceOf(entry), entry);
	}
	return [...bySource]
		.map(([source, entry]) => ({ source, tier: entry.tier, entry }))
		.sort((a, b) => SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source));
}

/** One entry per variation name, at the sources' average tier (two lists' "Deficit Push-Ups" are one). */
function mergeVariations(entries: RankingEntry[]): RankingEntry[] {
	const byName = new Map<string, RankingEntry[]>();
	for (const e of entries) byName.set(normalise(e.name), [...(byName.get(normalise(e.name)) ?? []), e]);
	return [...byName.values()]
		.map((same) => (same.length === 1 ? same[0] : { ...same[0], tier: averageTier(combine(same)) }))
		.sort(byTier);
}

/** The average tier; halfway between two, the first source's side wins. */
function averageTier(opinions: Opinion[]): ExerciseTier {
	const mean = opinions.reduce((n, o) => n + tierIndex(o.tier), 0) / opinions.length;
	const first = tierIndex(opinions[0].tier);
	const index = mean % 1 === 0.5 ? (first < mean ? Math.floor(mean) : Math.ceil(mean)) : Math.round(mean);
	return EXERCISE_TIERS[index];
}

export interface Rankings {
	/** The exercise's tier for each muscle it's ranked for, best first. */
	forExercise(id: string): ExerciseRank[];
	forMuscle(id: string, muscle: string): ExerciseRank | undefined;
	/** The best tier across muscles, for a compact badge. */
	best(id: string): ExerciseRank | undefined;
	/** A muscle's tier list, best first: one row per exercise (Hevy's, or the user's custom ones), plus entries no exercise matches. */
	listFor(muscle: string): MuscleRow[];
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
			const opinions = combine(sorted);
			const tier = averageTier(opinions);
			const rated = new Set(opinions.map((o) => o.entry));
			const better = mergeVariations(sorted.filter((e) => !rated.has(e))).filter((e) => tierIndex(e.tier) < tierIndex(tier));
			const spread = opinions.map((o) => tierIndex(o.tier));
			list.push({
				muscle,
				tier,
				entry: opinions[0].entry,
				opinions,
				disagree: Math.max(...spread) - Math.min(...spread) >= 2,
				better,
				entries: sorted,
			});
		}
		ranks.set(
			id,
			list.sort((a, b) => tierIndex(a.tier) - tierIndex(b.tier))
		);
	}

	const muscles = [...new Set(RANKINGS.flatMap((e) => e.muscles))];
	const listFor = (muscle: string) => {
		const seen = new Set<string>();
		const rows: MuscleRow[] = [];
		for (const entry of RANKINGS.filter((e) => e.muscles.includes(muscle))) {
			const ids = idsOf(entry);
			if (ids.length === 0) rows.push({ tier: entry.tier, entry });
			for (const id of ids) {
				const rank = ranks.get(id)?.find((r) => r.muscle === muscle);
				if (!rank || seen.has(id)) continue;
				seen.add(id);
				rows.push({ tier: rank.tier, entry: rank.entry, id, rank });
			}
		}
		// Stable, so each tier keeps the lists' order.
		return rows.sort((a, b) => tierIndex(a.tier) - tierIndex(b.tier));
	};

	return {
		forExercise: (id) => ranks.get(id) ?? [],
		forMuscle: (id, muscle) => ranks.get(id)?.find((r) => r.muscle === muscle),
		best: (id) => ranks.get(id)?.[0],
		listFor,
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
