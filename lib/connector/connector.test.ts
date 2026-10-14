import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeAll, describe, expect, it } from "vitest";
import type { ClaudeDraft, ClaudeUndo } from "../claude-sync";
import { DEFAULT_TRAINING_DEFAULTS } from "../training-defaults";
import type { Routine } from "../types";
import { createSetsmithServer, type ConnectorStore } from "./mcp-server";
import { pkceChallenge, seal, unseal } from "./seal";

const routine = (): Routine => ({
	id: "r1",
	name: "Upper/Lower",
	days: [{ id: "d1", name: "Upper", exercises: [{ exerciseId: "79D0BB3A", sets: 3 }] }],
});

/** The user's account in memory. */
function memoryStore(initial: Routine | null = routine()) {
	const state = {
		current: initial?.id ?? null as string | null,
		routines: new Map<string, Routine>(initial ? [[initial.id, initial]] : []),
		draft: null as ClaudeDraft | null,
		undo: null as ClaudeUndo | null,
	};
	const store: ConnectorStore = {
		currentRoutine: async () => (state.current ? state.routines.get(state.current) ?? null : null),
		listRoutines: async () => [...state.routines.values()],
		getRoutine: async (id) => state.routines.get(id) ?? null,
		setCurrentRoutine: async (id) => void (state.current = id),
		saveRoutine: async (r) => void state.routines.set(r.id, structuredClone(r)),
		priorities: async () => ({ S: ["Side Delts"] }),
		trainingDefaults: async () => DEFAULT_TRAINING_DEFAULTS,
		muscleOverrides: async () => ({}),
		draft: async () => state.draft,
		saveDraft: async (d) => void (state.draft = structuredClone(d)),
		clearDraft: async () => void (state.draft = null),
		undo: async () => state.undo,
		saveUndo: async (u) => void (state.undo = structuredClone(u)),
		clearUndo: async () => void (state.undo = null),
	};
	return { store, state };
}

async function connect(store: ConnectorStore) {
	const [a, b] = InMemoryTransport.createLinkedPair();
	await createSetsmithServer(store).connect(a);
	const client = new Client({ name: "test", version: "1" });
	await client.connect(b);
	const call = async (name: string, args: Record<string, unknown> = {}) => {
		const res = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
		return { text: res.content.map((c) => c.text).join("\n"), isError: Boolean(res.isError) };
	};
	return { client, call };
}

describe("Setsmith MCP server", () => {
	it("offers the coach tools plus review tools, with instructions", async () => {
		const { client } = await connect(memoryStore().store);
		const names = (await client.listTools()).tools.map((t) => t.name).sort();
		expect(names).toEqual(
			[
				"add_day", "add_exercise", "analyze_routine", "apply_changes", "create_routine", "discard_changes", "get_routine",
				"list_routines", "move_exercise", "remove_day", "remove_exercise", "search_exercises", "set_routine_name",
				"switch_routine", "undo_last_change", "update_day", "update_exercise",
			].sort()
		);
		expect(client.getInstructions()).toMatch(/apply_changes only after they clearly agree/);
	});

	it("drafts edits, applies them on request, and undoes", async () => {
		const { store, state } = memoryStore();
		const { call } = await connect(store);

		expect((await call("get_routine")).text).toMatch(/No changes are waiting[\s\S]*Bench Press \(Barbell\)[\s\S]*S: Side Delts/);

		const added = await call("add_exercise", { day_id: "d1", exercise_id: "422B08F1", sets: 4 });
		expect(added.text).toMatch(/Draft: 1 change waiting/);
		// The routine itself is untouched until applied; the draft holds the edit.
		expect(state.routines.get("r1")!.days[0].exercises).toHaveLength(1);
		expect(state.draft!.changes).toEqual(["Added Lateral Raise (Dumbbell) (4 sets) to Upper"]);
		expect((await call("get_routine")).text).toMatch(/Waiting changes \(1\):\n- Added Lateral Raise/);
		expect((await call("analyze_routine")).text).toMatch(/Side Delts \(tier S\): 4\.0 sets/);

		expect((await call("apply_changes")).text).toMatch(/Applied 1 change/);
		expect(state.routines.get("r1")!.days[0].exercises).toHaveLength(2);
		expect(state.draft).toBeNull();

		expect((await call("undo_last_change")).text).toMatch(/Restored/);
		expect(state.routines.get("r1")!.days[0].exercises).toHaveLength(1);
		expect((await call("undo_last_change")).isError).toBe(true);
	});

	it("discards drafts, ignores a stale one, and reports bad input as errors", async () => {
		const { store, state } = memoryStore();
		const { call } = await connect(store);
		await call("add_day", { name: "Lower" });
		expect((await call("discard_changes")).text).toMatch(/Discarded 1/);
		expect(state.draft).toBeNull();

		// A draft for a routine the user has since switched away from.
		state.draft = { routineId: "old", routine: { ...routine(), id: "old" }, changes: ["x"] };
		expect((await call("get_routine")).text).toMatch(/No changes are waiting/);
		expect((await call("apply_changes")).isError).toBe(true);

		const bad = await call("add_exercise", { day_id: "nope", exercise_id: "422B08F1", sets: 3 });
		expect(bad).toMatchObject({ isError: true });
		expect(bad.text).toMatch(/No day with id "nope"/);
	});

	it("creates and switches routines, opening them in the app", async () => {
		const { store, state } = memoryStore();
		const { call } = await connect(store);

		// Waiting changes block switching, so they aren't silently orphaned.
		await call("add_day", { name: "Extra" });
		expect(await call("create_routine", { name: "PPL" })).toMatchObject({ isError: true });
		await call("discard_changes");

		const created = await call("create_routine", { name: "PPL", day_names: ["Push", "Pull", "Legs"] });
		expect(created.text).toMatch(/Created and opened "PPL" in Setsmith; "Upper\/Lower" stays saved/);
		const ppl = [...state.routines.values()].find((r) => r.name === "PPL")!;
		expect(state.current).toBe(ppl.id);
		expect(ppl.days.map((d) => d.name)).toEqual(["Push", "Pull", "Legs"]);

		// Edits now build the new routine.
		await call("add_exercise", { day_id: ppl.days[0].id, exercise_id: "79D0BB3A", sets: 3 });
		expect(state.draft!.routineId).toBe(ppl.id);
		await call("apply_changes");
		expect(state.routines.get(ppl.id)!.days[0].exercises).toHaveLength(1);
		expect(state.routines.get("r1")!.days[0].exercises).toHaveLength(1);

		expect((await call("list_routines")).text).toMatch(/\* PPL \[routine-[^\]]+\]: 3 days, 3 sets \(open in Setsmith\)/);
		expect((await call("switch_routine", { routine_id: "r1" })).text).toMatch(/Opened "Upper\/Lower"/);
		expect(state.current).toBe("r1");
		expect(await call("switch_routine", { routine_id: "nope" })).toMatchObject({ isError: true });
	});

	it("can create the first routine in an empty account", async () => {
		const { store, state } = memoryStore(null);
		const { call } = await connect(store);
		expect((await call("create_routine", { name: "First" })).text).toMatch(/Created and opened "First"/);
		expect(state.routines.get(state.current!)!.days).toHaveLength(3);
	});

	it("explains what to do when the account has no routine", async () => {
		const { call } = await connect(memoryStore(null).store);
		expect((await call("get_routine")).text).toMatch(/no routine in this Setsmith account/);
	});
});

describe("connector OAuth tokens", () => {
	beforeAll(() => {
		process.env.SETSMITH_CONNECTOR_SECRET = "test-secret-that-is-at-least-32-characters";
	});

	it("seals tokens that only open as their own type, and expire", () => {
		const access = seal({ t: "access", rt: "rt", uid: "u", exp: Date.now() + 1000 });
		expect(unseal(access, "access")).toMatchObject({ uid: "u" });
		expect(unseal(access, "refresh")).toBeNull();
		expect(unseal(access.slice(0, -2) + "xx", "access")).toBeNull();
		expect(unseal(seal({ t: "access", rt: "rt", uid: "u", exp: Date.now() - 1 }), "access")).toBeNull();
	});

	it("exchanges a code with PKCE for tokens, and refreshes", async () => {
		const { POST } = await import("@/app/api/oauth/token/route");
		const verifier = "v".repeat(50);
		const clientId = seal({ t: "client", redirectUris: ["https://claude.ai/cb"], name: "Claude" });
		const code = seal({
			t: "code", rt: "firebase-rt", uid: "u1", clientId, redirectUri: "https://claude.ai/cb",
			challenge: pkceChallenge(verifier), exp: Date.now() + 60_000,
		});
		const form = (p: Record<string, string>) =>
			POST(new Request("http://x/api/oauth/token", { method: "POST", body: new URLSearchParams(p) }));

		const wrong = await form({ grant_type: "authorization_code", code, client_id: clientId, redirect_uri: "https://claude.ai/cb", code_verifier: "w".repeat(50) });
		expect(wrong.status).toBe(400);

		const ok = await (await form({ grant_type: "authorization_code", code, client_id: clientId, redirect_uri: "https://claude.ai/cb", code_verifier: verifier })).json();
		expect(unseal(ok.access_token, "access")).toMatchObject({ rt: "firebase-rt", uid: "u1" });

		const refreshed = await (await form({ grant_type: "refresh_token", refresh_token: ok.refresh_token, client_id: clientId })).json();
		expect(unseal(refreshed.access_token, "access")).toMatchObject({ uid: "u1" });

		const otherClient = await form({ grant_type: "refresh_token", refresh_token: ok.refresh_token, client_id: "someone-else" });
		expect(otherClient.status).toBe(400);
	});

	it("turns away MCP requests without a valid token, pointing to sign-in", async () => {
		const { POST } = await import("@/app/api/mcp/route");
		const res = await POST(new Request("https://setsmith.netlify.app/api/mcp", { method: "POST", body: "{}" }));
		expect(res.status).toBe(401);
		expect(res.headers.get("WWW-Authenticate")).toMatch(/resource_metadata=".*\/\.well-known\/oauth-protected-resource"/);
	});
});
