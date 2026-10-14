// Turns a routine written as plain text (notes, a spreadsheet, a Reddit
// post) into a Setsmith routine: day headings, then one exercise per line
// with optional sets and reps, matched to the exercise library by name.

import { STAPLE_IDS } from "./staples";
import type { Exercise, RepRange } from "./types";

export interface ParsedLine {
	line: string;
	name: string;
	sets: number;
	reps?: RepRange;
	match: Exercise | null;
	/** 0 to 1: how closely the best match's name fits. */
	confidence: number;
}

export interface ParsedDay {
	name: string;
	lines: ParsedLine[];
}

// Gym shorthand, expanded before matching.
const ALIASES: [RegExp, string][] = [
	[/\bdbs?\b/g, "dumbbell"],
	[/\bbbs?\b/g, "barbell"],
	[/\bkbs?\b/g, "kettlebell"],
	[/\brdls?\b/g, "romanian deadlift"],
	[/\bsldls?\b/g, "straight leg deadlift"],
	[/\bohp\b/g, "overhead press"],
	[/\bbss\b/g, "bulgarian split squat"],
	[/\bghr\b/g, "glute ham raise"],
	[/\bskull ?crushers?\b/g, "skullcrusher"],
	[/\bpull ?downs?\b/g, "pulldown"],
	[/\bpush ?downs?\b/g, "pushdown"],
	[/\bpull ?ups?\b/g, "pull up"],
	[/\bchin ?ups?\b/g, "chin up"],
	[/\bpush ?ups?\b/g, "push up"],
	[/\bsit ?ups?\b/g, "sit up"],
	[/\bdips\b/g, "dip"],
	[/\blat raises?\b/g, "lateral raise"],
	[/\bside raises?\b/g, "lateral raise"],
	[/\bhip thrusts?\b/g, "hip thrust"],
	[/\bcalf raises?\b/g, "calf raise"],
	[/\bflyes\b/g, "fly"],
	[/\bflies\b/g, "fly"],
	[/\bpec ?deck\b/g, "butterfly pec deck"],
	[/\bcurls\b/g, "curl"],
	[/\bextensions\b/g, "extension"],
	[/\brows\b/g, "row"],
	[/\bsquats\b/g, "squat"],
	[/\blunges\b/g, "lunge"],
	[/\bdeadlifts\b/g, "deadlift"],
	[/\bpresses\b/g, "press"],
	[/\bshrugs\b/g, "shrug"],
	[/\bcrunches\b/g, "crunch"],
];

const EQUIPMENT_WORDS = new Set(["barbell", "dumbbell", "cable", "machine", "kettlebell", "band", "smith", "plate", "bodyweight", "suspension"]);
const EQUIPMENT_DEFAULT: Record<string, number> = { barbell: 0.03, dumbbell: 0.02, machine: 0.01 };

// "grip" alone says little: "wide grip pulldown" shouldn't become the close-grip one.
const STOP_WORDS = new Set(["the", "a", "of", "on", "with", "and", "sets", "set", "reps", "rep", "x", "each", "per", "side", "grip"]);

const tokens = (text: string) =>
	text
		.toLowerCase()
		.replace(/[^a-z0-9 ]+/g, " ")
		.split(/\s+/)
		.filter((t) => t && !STOP_WORDS.has(t))
		.map((t) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));

function normalise(name: string): string {
	// "Pull-ups" and "pull ups" are the same exercise.
	let text = name.toLowerCase().replace(/[-–]/g, " ");
	for (const [pattern, replacement] of ALIASES) text = text.replace(pattern, replacement);
	return text;
}

/** The library exercise whose name best fits, with how well it fits. */
export function matchExercise(name: string, exercises: Exercise[]): { match: Exercise | null; confidence: number } {
	const query = new Set(tokens(normalise(name)));
	if (query.size === 0) return { match: null, confidence: 0 };
	const namesEquipment = [...query].some((t) => EQUIPMENT_WORDS.has(t));
	let best: Exercise | null = null;
	let bestScore = 0;
	for (const ex of exercises) {
		if (ex.legacy) continue;
		const words = new Set(tokens(ex.name));
		let shared = 0;
		for (const w of query) if (words.has(w)) shared++;
		if (shared === 0) continue;
		// How much of what was written is matched, minus a little for extra
		// words in the name, so "bench press" prefers "Bench Press (Barbell)"
		// over "Bench Press - Close Grip (Barbell)".
		// Staples win close calls ("barbell rows" is Bent Over Row, not
		// Meadows Row), and with no equipment named, the gym's default reading
		// wins: "bench press" means barbell, "lateral raise" dumbbell.
		const score =
			shared / query.size -
			(words.size - shared) * 0.04 +
			(STAPLE_IDS.has(ex.id) ? 0.05 : 0) +
			(namesEquipment ? 0 : (EQUIPMENT_DEFAULT[ex.equipment ?? ""] ?? 0));
		if (score > bestScore) {
			bestScore = score;
			best = ex;
		}
	}
	const confidence = Math.max(0, Math.min(1, bestScore));
	return confidence >= 0.5 ? { match: best, confidence } : { match: null, confidence };
}

// "3x8", "3 x 8-12", "4×10", "3 sets of 10", "3 sets", "x 12 reps"
const SETS_REPS = /(\d{1,2})\s*(?:x|×|\*|sets?\s*(?:of|x)?)\s*(\d{1,3})(?:\s*(?:-|–|to)\s*(\d{1,3}))?/i;
const SETS_ONLY = /(\d{1,2})\s*sets?\b/i;

const clean = (line: string) =>
	line
		.replace(/^\s*(?:[-*•·>]|\d+[.)])\s*/, "")
		.replace(/[:\-–|,]+\s*$/, "")
		.trim();

function parseExerciseLine(line: string): { name: string; sets: number; reps?: RepRange } | null {
	const text = clean(line);
	const sr = text.match(SETS_REPS);
	if (sr) {
		const sets = Number(sr[1]);
		const min = Number(sr[2]);
		const max = sr[3] ? Number(sr[3]) : min;
		const name = text.replace(sr[0], " ").replace(/\breps?\b/gi, " ").replace(/[@:,|()-]+/g, " ").trim();
		return { name, sets, reps: { min: Math.min(min, max), max: Math.max(min, max) } };
	}
	const so = text.match(SETS_ONLY);
	if (so) return { name: text.replace(so[0], " ").replace(/[@:,|()-]+/g, " ").trim(), sets: Number(so[1]) };
	return null;
}

// Words that make up day names: splits, muscle groups, weekdays, labels.
const HEADING_WORDS = new Set(
	(
		"day days week upper lower push pull leg legs full body chest back arm arms shoulder shoulders delt delts " +
		"bicep biceps tricep triceps glute glutes hamstring hamstrings quad quads calf calves core ab abs posterior anterior " +
		"chain monday tuesday wednesday thursday friday saturday sunday mon tue wed thu fri sat sun workout session rest " +
		"and a b c d 1 2 3 4 5 6 7"
	).split(" ")
);

/** A line made only of split, muscle and weekday words: "Push day", "Chest & Triceps", "Upper A". */
const looksLikeHeading = (line: string) => {
	const words = clean(line).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
	return words.length > 0 && words.length <= 5 && words.every((w) => HEADING_WORDS.has(w));
};

export function parseRoutineText(text: string, exercises: Exercise[]): ParsedDay[] {
	const days: ParsedDay[] = [];
	const current = () => {
		if (days.length === 0) days.push({ name: "Day 1", lines: [] });
		return days[days.length - 1];
	};

	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line) continue;
		const parsed = parseExerciseLine(line);
		const name = parsed?.name ?? clean(line);
		const { match, confidence } = matchExercise(name, exercises);
		// Without sets, a line is a heading if it ends in ":" or starts with "#",
		// is made of day-name words ("Legs", "Push day"), or names no exercise.
		// "Leg press" names one, so it stays an exercise.
		const heading = !parsed && (/:\s*$/.test(line) || /^\s*#/.test(line) || !match || looksLikeHeading(line));
		if (heading) {
			days.push({ name: clean(line.replace(/^\s*#+/, "")).slice(0, 60) || `Day ${days.length + 1}`, lines: [] });
			continue;
		}
		current().lines.push({
			line,
			name,
			sets: Math.min(10, Math.max(1, parsed?.sets ?? 3)),
			reps: parsed?.reps,
			match,
			confidence,
		});
	}
	return days.filter((d) => d.lines.length > 0);
}
