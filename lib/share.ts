// Routines shared as links: the routine is packed into a compact array,
// deflated and base64url-encoded into the link (/r/<code>). The same code
// runs in the browser and on the server (for link previews).

import type { Routine, RoutineExercise } from "./types";

// [exerciseId, sets, repsMin?, repsMax?, restSeconds?, durationSeconds?, notes?]
type PackedExercise = [string, number, number?, number?, number?, number?, string?];
type PackedRoutine = { v: 1; n: string; d: [string, PackedExercise[]][] };

const MAX_CODE_LENGTH = 6000;

// Hevy built-in exercise ids; custom exercises and legacy ids don't exist
// for whoever opens the link.
const isShareable = (id: string) => /^[0-9A-Z]{8}$/.test(id);

function pack(routine: Routine): { packed: PackedRoutine; skipped: number } {
	let skipped = 0;
	const d = routine.days.map((day): [string, PackedExercise[]] => [
		day.name,
		day.exercises.flatMap((ex): PackedExercise[] => {
			if (!isShareable(ex.exerciseId)) {
				skipped++;
				return [];
			}
			const row: PackedExercise = [
				ex.exerciseId,
				ex.sets,
				ex.reps?.min,
				ex.reps?.max,
				ex.restSeconds,
				ex.durationSeconds,
				ex.notes,
			];
			while (row.length > 2 && row[row.length - 1] === undefined) row.pop();
			return [row];
		}),
	]);
	return { packed: { v: 1, n: routine.name, d }, skipped };
}

function unpack(packed: PackedRoutine): Routine {
	if (packed?.v !== 1 || typeof packed.n !== "string" || !Array.isArray(packed.d)) {
		throw new Error("Not a Setsmith routine link.");
	}
	const num = (n: unknown, min: number, max: number) =>
		typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : undefined;
	return {
		id: `shared-${Date.now().toString(36)}`,
		name: packed.n.slice(0, 80) || "Shared routine",
		days: packed.d.slice(0, 14).map(([name, exercises], i) => ({
			id: `day-${Date.now().toString(36)}-${i}`,
			name: String(name).slice(0, 60) || `Day ${i + 1}`,
			exercises: (Array.isArray(exercises) ? exercises : [])
				.filter((row) => Array.isArray(row) && typeof row[0] === "string" && isShareable(row[0]))
				.slice(0, 30)
				.map(([id, sets, rMin, rMax, rest, duration, notes]): RoutineExercise => {
					const ex: RoutineExercise = { exerciseId: id, sets: num(sets, 1, 10) ?? 3 };
					const min = num(rMin, 1, 100);
					const max = num(rMax, 1, 100);
					if (min !== undefined && max !== undefined) ex.reps = { min: Math.min(min, max), max: Math.max(min, max) };
					const r = num(rest, 0, 900);
					if (r !== undefined) ex.restSeconds = r;
					const dur = num(duration, 5, 3600);
					if (dur !== undefined) ex.durationSeconds = dur;
					if (typeof notes === "string" && notes) ex.notes = notes.slice(0, 300);
					return ex;
				}),
		})),
	};
}

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
	const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
	return new Uint8Array(await out.arrayBuffer());
}

const toBase64Url = (bytes: Uint8Array) => {
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (code: string) => {
	const binary = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

/** The share code, and how many exercises were left out (custom ones). */
export async function encodeRoutine(routine: Routine): Promise<{ code: string; skipped: number }> {
	const { packed, skipped } = pack(routine);
	const bytes = new TextEncoder().encode(JSON.stringify(packed));
	return { code: toBase64Url(await transform(bytes, new CompressionStream("deflate-raw"))), skipped };
}

export async function decodeRoutine(code: string): Promise<Routine> {
	if (!code || code.length > MAX_CODE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(code)) {
		throw new Error("Not a Setsmith routine link.");
	}
	try {
		const bytes = await transform(fromBase64Url(code), new DecompressionStream("deflate-raw"));
		return unpack(JSON.parse(new TextDecoder().decode(bytes)));
	} catch {
		throw new Error("This routine link is damaged or incomplete.");
	}
}
