// Verifies data/exercise-weightings.json against the Hevy catalogue snapshot.
// Exits non-zero on any problem so it can gate builds and CI.
//
// Usage: npm run check:exercises [-- --strict]

import { readFileSync } from "node:fs";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

const catalog = read("../data/hevy-exercises.json");
const weightings = read("../data/exercise-weightings.json");
// Every muscle the analysis can score has volume landmarks.
const muscles = new Set(Object.keys(read("../data/volume-landmarks.json")));

const byId = new Map(catalog.map((e) => [e.id, e]));
const problems = [];
const problem = (id, msg) => problems.push(`${id}  ${byId.get(id)?.title ?? weightings[id]?.title ?? "?"}: ${msg}`);

for (const e of catalog) {
	if (!weightings[e.id]) problem(e.id, "no weightings");
}

for (const [id, entry] of Object.entries(weightings)) {
	const exercise = byId.get(id);
	if (!exercise) {
		problem(id, "not in the Hevy catalogue (removed upstream?)");
		continue;
	}
	if (entry.title !== exercise.title) {
		problem(id, `checked as "${entry.title}" but Hevy now calls it "${exercise.title}"; re-verify, then update title`);
	}
	if ("compound" in entry && typeof entry.compound !== "boolean") {
		problem(id, '"compound" must be true or false');
	}
	const values = Object.entries(entry.muscles ?? {});
	// Cardio and mobility work legitimately count toward no muscle.
	if (values.length === 0 && !entry.noMuscleVolume) {
		problem(id, 'no muscles; set "noMuscleVolume": true if that is intended');
	}
	for (const [muscle, w] of values) {
		if (!muscles.has(muscle)) problem(id, `unknown muscle "${muscle}"`);
		if (typeof w !== "number" || w <= 0 || w > 1) problem(id, `${muscle} weighting ${w} is outside (0, 1]`);
	}
	if (values.length > 0 && !values.some(([, w]) => w === 1)) {
		problem(id, "no primary muscle at 1.0");
	}
}

if (problems.length) {
	console.error(`${problems.length} exercise weighting problem(s):\n`);
	for (const p of problems) console.error(`  ${p}`);
	process.exit(1);
}
// Drafts are valid but unreviewed: reviewing one means checking its muscles
// and removing its "draft" flag. --strict fails while any remain.
const drafts = Object.values(weightings).filter((e) => e.draft).length;
console.log(`OK: ${Object.keys(weightings).length} exercises have valid weightings.`);
if (drafts) {
	console.warn(`${drafts} are drafts awaiting review (search for "draft": true).`);
	if (process.argv.includes("--strict")) process.exit(1);
}
