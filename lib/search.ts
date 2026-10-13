// Exercise search shared by the library, the command menu and Claude's
// search tool: every word must appear, and better matches come first.

import { STAPLE_IDS } from "./staples";
import type { Exercise } from "./types";

/** 0 is best: name starts with the query, then whole-word matches, then any match. */
function score(name: string, words: string[]): number {
	const lower = name.toLowerCase();
	const tokens = lower.split(/[^a-z0-9]+/);
	let s = lower.startsWith(words[0]) ? 0 : 10;
	for (const w of words) s += tokens.some((t) => t === w) ? 0 : tokens.some((t) => t.startsWith(w)) ? 1 : 3;
	return s;
}

export function searchExercises(exercises: Exercise[], query: string): Exercise[] {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return exercises;
	return exercises
		.filter((e) => {
			const name = e.name.toLowerCase();
			return words.every((w) => name.includes(w));
		})
		// Staples (bench press, lateral raise...) win ties over obscure variants.
		.map((e) => ({ e, s: score(e.name, words) - (STAPLE_IDS.has(e.id) ? 2 : 0) }))
		.sort((a, b) => a.s - b.s || a.e.name.length - b.e.name.length || a.e.name.localeCompare(b.e.name))
		.map(({ e }) => e);
}
