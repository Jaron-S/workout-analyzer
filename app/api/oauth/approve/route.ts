import { Session } from "@/lib/connector/firebase-rest";
import { CODE_TTL_MS, json, serverConnection } from "@/lib/connector/oauth";
import { seal, unseal } from "@/lib/connector/seal";

// Called by the consent page once the user is signed in and has said yes.
// Checks the request against the client's registration, confirms the user's
// Firebase session, and returns the redirect back to Claude with a code that
// carries the user's refresh token (the connector acts as them with it).

export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const str = (k: string) => (typeof body?.[k] === "string" ? (body[k] as string) : "");

	const client = unseal(str("client_id"), "client");
	const redirectUri = str("redirect_uri");
	if (!client || !client.redirectUris.includes(redirectUri)) {
		return json({ error: "This connection request is invalid. Start again from Claude." }, 400);
	}
	if (str("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(str("code_challenge"))) {
		return json({ error: "This connection request is missing PKCE. Start again from Claude." }, 400);
	}

	const session = new Session(serverConnection(), str("refresh_token"));
	try {
		await session.token();
	} catch {
		return json({ error: "Your sign-in has expired. Sign in again and retry." }, 401);
	}
	if (session.uid !== str("uid")) return json({ error: "Signed-in account mismatch. Sign in again and retry." }, 401);

	const code = seal({
		t: "code",
		rt: str("refresh_token"),
		uid: session.uid,
		clientId: str("client_id"),
		redirectUri,
		challenge: str("code_challenge"),
		exp: Date.now() + CODE_TTL_MS,
	});
	const target = new URL(redirectUri);
	target.searchParams.set("code", code);
	if (str("state")) target.searchParams.set("state", str("state"));
	return json({ redirect: target.toString() });
}

/** What the consent page shows: the client's name and where it will send the user back. */
export async function GET(request: Request) {
	const url = new URL(request.url);
	const client = unseal(url.searchParams.get("client_id"), "client");
	const redirectUri = url.searchParams.get("redirect_uri") ?? "";
	if (!client || !client.redirectUris.includes(redirectUri)) return json({ valid: false });
	return json({ valid: true, name: client.name, host: new URL(redirectUri).host });
}
