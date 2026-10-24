// Builds data/exercise-rankings.json from the tier lists as written
// (data/exercise-rankings.source.md) and how they map to Hevy
// (data/exercise-rankings.mapping.json). Fails, listing what's missing, when
// the doc has an exercise or a numbered cue the mapping doesn't cover yet.
//
// Usage: npm run build:rankings

import { readFileSync, writeFileSync } from "node:fs";

const path = (p) => new URL(p, import.meta.url);
const doc = readFileSync(path("../data/exercise-rankings.source.md"), "utf8").replaceAll("\\", "");
const mapping = JSON.parse(readFileSync(path("../data/exercise-rankings.mapping.json"), "utf8"));

/** Splits on commas outside brackets. */
function splitItems(items) {
	const parts = [];
	let depth = 0;
	let current = "";
	for (const ch of items) {
		if (ch === "(") depth++;
		if (ch === ")") depth--;
		if (ch === "," && depth === 0) {
			parts.push(current);
			current = "";
		} else current += ch;
	}
	parts.push(current);
	return parts.map((p) => p.trim()).filter(Boolean);
}

// Sections are "# **Chest Exercises (Jeff Nippard)**", some split into lists
// ("### **Chest Exercises**"). Tier lines ("* **High A Tier:** a, b"), or a
// tier line followed by labelled sub-lists ("  * **Lower Abs Focus:** a, b").
const entries = [];
let section = null;
let source = null;
let list = null;
let tier = null;
let subLists = false;
for (const line of doc.split("\n")) {
	const top = line.match(/^# \*\*(.+?)(?: Exercises)?(?: \((.+?)\))?\*\*/);
	if (top) {
		section = top[1];
		source = top[2]?.replace(/^Dr\. /, "") ?? null;
		list = section;
		tier = null;
		continue;
	}
	const sub = line.match(/^### \*\*(.+?)(?: Exercises)?\*\*/) ?? line.match(/^## \*\*(Rear Delts) Tier List/);
	if (sub) {
		list = line.startsWith("###") ? `${section} / ${sub[1]}` : sub[1];
		tier = null;
		continue;
	}
	const tierLine = line.match(/^\* \*\*((?:High |Low )?(?:S\+|[SABCDEF])) Tier.*?:\*\*\s*(.*)/);
	if (tierLine && list) {
		tier = tierLine[1];
		const items = tierLine[2].trim();
		subLists = items === "";
		if (items && !/^none/i.test(items)) for (const name of splitItems(items)) entries.push({ list, source, tier, name });
		continue;
	}
	const focus = line.match(/^\s+\* \*\*(.+?):\*\*\s*(.*)/);
	if (focus && subLists && !/^(Form|Execution)/.test(focus[1])) {
		for (const name of splitItems(focus[2])) entries.push({ list, source, tier, name, focus: focus[1] });
	}
}

// Numbered cues: "12. **Name**" then Setup/Execution bullets, or one line ("28. **Name:** text").
const cues = new Map();
for (const m of doc.matchAll(/^\s*(\d+)\. \*\*(.+?)\*\*\s*\n((?:\s+\* .*\n?)+)/gm)) {
	const setup = m[3].match(/\*\*Form & Setup:\*\* (.*)/);
	const execution = m[3].match(/\*\*Execution & Cues:\*\* (.*)/);
	cues.set(m[1], {
		...(setup ? { setup: setup[1].trim() } : {}),
		...(execution ? { execution: execution[1].trim() } : {}),
	});
}
for (const m of doc.matchAll(/^\s*(\d+)\. \*\*.+?:\*\* (.+?)\s*$/gm)) cues.set(m[1], { execution: m[2].trim() });

const problems = [];
const cueOf = new Map();
for (const n of cues.keys()) {
	if (!(n in mapping.cues)) problems.push(`cue ${n}: say which entries it belongs to in "cues"`);
}
for (const [n, keys] of Object.entries(mapping.cues)) {
	if (!cues.has(n)) problems.push(`cue ${n}: not in the doc`);
	for (const key of keys) cueOf.set(key, cues.get(n));
}

const FIX_NAME = [["Half-Neeling", "Half-Kneeling"], ["PEC", "Pec"], ["SkullCrushers", "Skullcrushers"], ["Brachio-Radialis", "Brachioradialis"]];
const NOTE = "#1 Choice|Hell|Worst|Hazard|Redundant|Ego";
const fixName = (name) => FIX_NAME.reduce((n, [a, b]) => n.replaceAll(a, b), name);
// The doc's asides in brackets ("Upper Glute #1 Choice") become notes.
const display = (name) => fixName(name).replace(new RegExp(`\\s*\\((?:[^()]*(?:${NOTE})[^()]*)\\)`), "").trim();
const noteOf = (name) => fixName(name).match(new RegExp(`\\(([^()]*(?:${NOTE})[^()]*)\\)`))?.[1];
// "High A" is an A; the one "E" sits below D, so F.
const tierOf = (label) => {
	const t = label.replace(/^(High|Low) /, "");
	return t === "E" ? "F" : t;
};

const rankings = [];
const used = new Set();
for (const e of entries) {
	const key = `${e.list} / ${e.name}`;
	const m = mapping.entries[key];
	const listInfo = mapping.lists[e.list];
	if (!listInfo) {
		problems.push(`list "${e.list}": add it to "lists"`);
		continue;
	}
	if (!m) {
		problems.push(`${key}: add it to "entries" (Hevy ids, or [] if Hevy has none)`);
		continue;
	}
	used.add(key);
	if (m.skip) continue;
	const muscles = m.muscles ?? listInfo.muscles;
	if (!muscles) problems.push(`${key}: the ${e.list} list has no muscles, so give the entry some`);
	const tier = m.tier ?? tierOf(e.tier);
	const note = m.note ?? [e.focus, noteOf(e.name)].filter(Boolean).join("; ");
	// Jeff Nippard's lists are the default, so left unsaid.
	const entrySource = e.source === "Jeff Nippard" ? null : e.source;
	rankings.push({
		name: m.name ?? display(e.name),
		tier,
		muscles,
		hevyIds: m.hevyIds,
		...(e.tier !== tier && !m.tier ? { listedAs: e.tier } : {}),
		...(note ? { note } : {}),
		...(m.variation ? { variation: true } : {}),
		...(entrySource ? { source: entrySource } : {}),
		...(cueOf.has(key) ? { cues: cueOf.get(key) } : {}),
	});
}
for (const key of Object.keys(mapping.entries)) {
	if (!used.has(key)) problems.push(`${key}: not in the doc any more; remove it from "entries"`);
}
// Estimates only fill gaps: never averaged with a list's rating.
const listed = new Set(rankings.flatMap((r) => r.hevyIds.flatMap((id) => r.muscles.map((m) => `${id} ${m}`))));
for (const est of mapping.estimates) {
	for (const id of est.hevyIds) {
		for (const m of est.muscles) if (listed.has(`${id} ${m}`)) problems.push(`estimate ${est.name}: a list already ranks it for ${m}`);
	}
	rankings.push({ ...est, source: "Setsmith estimate" });
}

if (problems.length) {
	console.error(`${problems.length} problem(s):\n`);
	for (const p of problems) console.error(`  ${p}`);
	process.exit(1);
}

const data = {
	source:
		"Tier lists from YouTube (Jeff Nippard, Jeremy Ethier, Mike Israetel / Milo Wolf), plus a few Setsmith estimates, mapped to Hevy's exercises. Built from data/exercise-rankings.source.md and data/exercise-rankings.mapping.json by npm run build:rankings.",
	rankings,
};
// Short string arrays on one line.
const text = JSON.stringify(data, null, "\t").replace(/\[\s*((?:"[^"]*",?\s*)*)\]/g, (_, items) =>
	`[${[...items.matchAll(/"[^"]*"/g)].map((x) => x[0]).join(", ")}]`
);
writeFileSync(path("../data/exercise-rankings.json"), `${text}\n`);
const notInHevy = rankings.filter((r) => r.hevyIds.length === 0).length;
console.log(`OK: ${rankings.length} rankings (${notInHevy} not in Hevy), ${rankings.filter((r) => r.cues).length} with form cues.`);
