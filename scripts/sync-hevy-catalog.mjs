// Refreshes data/hevy-exercises.json (Hevy's built-in exercise catalogue) and
// reports what changed against data/exercise-weightings.json.
//
// Usage: npm run sync:hevy   (needs HEVY_API_KEY in .env.local; read-only)
//
// Custom exercises on the key's account are skipped: they are per-account and
// are fetched live in the app instead.

import { readFileSync, writeFileSync } from "node:fs";

const CATALOG_PATH = new URL("../data/hevy-exercises.json", import.meta.url);
const WEIGHTINGS_PATH = new URL("../data/exercise-weightings.json", import.meta.url);

const apiKey = process.env.HEVY_API_KEY;
if (!apiKey) {
	console.error("HEVY_API_KEY is not set. Add it to .env.local.");
	process.exit(1);
}

async function fetchAllTemplates() {
	const templates = [];
	for (let page = 1; ; page++) {
		const res = await fetch(
			`https://api.hevyapp.com/v1/exercise_templates?page=${page}&pageSize=100`,
			{ headers: { "api-key": apiKey } }
		);
		if (!res.ok) throw new Error(`Hevy API ${res.status} on page ${page}`);
		const body = await res.json();
		templates.push(...body.exercise_templates);
		if (page >= body.page_count) return templates;
	}
}

const readJson = (path, fallback) => {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return fallback;
	}
};

const previous = new Map(readJson(CATALOG_PATH, []).map((e) => [e.id, e]));
const weightings = readJson(WEIGHTINGS_PATH, {});

const catalog = (await fetchAllTemplates())
	.filter((t) => !t.is_custom)
	.map((t) => ({
		id: t.id,
		title: t.title,
		type: t.type,
		equipment: t.equipment,
		primary_muscle_group: t.primary_muscle_group,
		secondary_muscle_groups: t.secondary_muscle_groups,
		thumbnail_url: t.thumbnail_url,
	}))
	.sort((a, b) => a.title.localeCompare(b.title));

writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, "\t") + "\n");

const current = new Map(catalog.map((e) => [e.id, e]));
const added = catalog.filter((e) => !previous.has(e.id));
const removed = [...previous.values()].filter((e) => !current.has(e.id));
const renamed = catalog.filter(
	(e) => previous.has(e.id) && previous.get(e.id).title !== e.title
);
const needsWeightings = catalog.filter((e) => !weightings[e.id]);
const staleTitles = catalog.filter(
	(e) => weightings[e.id] && weightings[e.id].title !== e.title
);

const list = (label, items, fmt) => {
	if (items.length === 0) return;
	console.log(`\n${label} (${items.length}):`);
	for (const item of items) console.log(`  ${fmt(item)}`);
};

console.log(`Wrote ${catalog.length} built-in exercises to data/hevy-exercises.json`);
list("Added", added, (e) => `${e.id}  ${e.title}`);
list("Removed", removed, (e) => `${e.id}  ${e.title}  (check saved routines that use it)`);
list("Renamed", renamed, (e) => `${e.id}  "${previous.get(e.id).title}" -> "${e.title}"`);
list("Missing weightings", needsWeightings, (e) => `${e.id}  ${e.title}`);
list(
	"Weightings to re-verify (title changed since they were checked)",
	staleTitles,
	(e) => `${e.id}  checked as "${weightings[e.id].title}", now "${e.title}"`
);
if (needsWeightings.length || staleTitles.length) {
	console.log("\nUpdate data/exercise-weightings.json, then run npm run check:exercises.");
}
