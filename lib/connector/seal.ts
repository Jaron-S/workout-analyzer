import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Sealed tokens for the connector's OAuth flow. Client ids, authorization
// codes, access and refresh tokens are small JSON payloads encrypted and
// authenticated with AES-256-GCM under SETSMITH_CONNECTOR_SECRET, so the
// server keeps no token database: whoever holds a valid token can open it,
// nobody else can read or forge one. Server-only.

export type Sealed =
	| { t: "client"; redirectUris: string[]; name: string }
	| { t: "code"; rt: string; uid: string; clientId: string; redirectUri: string; challenge: string; exp: number }
	| { t: "access"; rt: string; uid: string; exp: number }
	| { t: "refresh"; rt: string; uid: string; clientId: string };

function key(): Buffer {
	const secret = process.env.SETSMITH_CONNECTOR_SECRET;
	if (!secret || secret.length < 32) throw new Error("SETSMITH_CONNECTOR_SECRET is not set (at least 32 characters).");
	return createHash("sha256").update(secret).digest();
}

export function seal(payload: Sealed): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key(), iv);
	const body = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
	return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** The payload if the token is genuine, of the expected type and unexpired; otherwise null. */
export function unseal<T extends Sealed["t"]>(token: string | null | undefined, type: T): Extract<Sealed, { t: T }> | null {
	if (!token) return null;
	try {
		const raw = Buffer.from(token, "base64url");
		const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
		decipher.setAuthTag(raw.subarray(12, 28));
		const payload = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")) as Sealed;
		if (payload.t !== type) return null;
		if ("exp" in payload && payload.exp < Date.now()) return null;
		return payload as Extract<Sealed, { t: T }>;
	} catch {
		return null;
	}
}

/** PKCE S256: base64url(sha256(verifier)). */
export function pkceChallenge(verifier: string): string {
	return createHash("sha256").update(verifier).digest("base64url");
}
