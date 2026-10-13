// Firebase Auth and Firestore over their REST APIs, signed in as the user.
//
// The connector runs on the server without the browser SDK, so it holds the
// user's refresh token and exchanges it for short-lived ID tokens. Firestore
// requests carry the ID token, so the project's security rules apply exactly
// as in the app: the connector can only reach the signed-in user's own data.
// Adapted from the habit-tracker connector.

export interface Connection {
	apiKey: string;
	projectId: string;
}

export class FirebaseError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

async function call<T>(url: string, init: RequestInit): Promise<T> {
	const res = await fetch(url, init);
	const text = await res.text();
	const body = text ? JSON.parse(text) : {};
	if (!res.ok) throw new FirebaseError(body?.error?.message ?? res.statusText, res.status);
	return body as T;
}

export class Session {
	private idToken: string | null = null;
	private expiresAt = 0;
	uid = "";
	email = "";

	constructor(
		readonly connection: Connection,
		private refreshToken: string
	) {}

	async token(): Promise<string> {
		if (this.idToken && Date.now() < this.expiresAt) return this.idToken;
		const res = await call<{ id_token: string; refresh_token: string; expires_in: string }>(
			`https://securetoken.googleapis.com/v1/token?key=${this.connection.apiKey}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: this.refreshToken }),
			}
		);
		this.refreshToken = res.refresh_token;
		this.idToken = res.id_token;
		// Refresh a minute early so a token never expires mid-request.
		this.expiresAt = Date.now() + (Number(res.expires_in) - 60) * 1000;
		const claims = JSON.parse(Buffer.from(res.id_token.split(".")[1], "base64url").toString("utf8"));
		this.uid = claims.user_id ?? claims.sub;
		this.email = claims.email ?? "";
		return this.idToken;
	}
}

// --- Firestore values ---

type FsValue =
	| { nullValue: null }
	| { booleanValue: boolean }
	| { integerValue: string }
	| { doubleValue: number }
	| { stringValue: string }
	| { timestampValue: string }
	| { arrayValue: { values?: FsValue[] } }
	| { mapValue: { fields?: Record<string, FsValue> } };

type Fields = Record<string, FsValue>;

function encode(value: unknown): FsValue {
	if (value === null || value === undefined) return { nullValue: null };
	if (typeof value === "boolean") return { booleanValue: value };
	if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
	if (typeof value === "string") return { stringValue: value };
	if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
	if (typeof value === "object") return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
	throw new Error(`Can't store ${typeof value} in Firestore`);
}

// Undefined fields are left out, as the browser SDK requires.
const encodeFields = (data: Record<string, unknown>): Fields =>
	Object.fromEntries(
		Object.entries(data)
			.filter(([, v]) => v !== undefined)
			.map(([k, v]) => [k, encode(v)])
	);

function decode(value: FsValue): unknown {
	if ("nullValue" in value) return null;
	if ("booleanValue" in value) return value.booleanValue;
	if ("integerValue" in value) return Number(value.integerValue);
	if ("doubleValue" in value) return value.doubleValue;
	if ("stringValue" in value) return value.stringValue;
	if ("timestampValue" in value) return value.timestampValue;
	if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decode);
	if ("mapValue" in value) return decodeFields(value.mapValue.fields ?? {});
	return undefined;
}

const decodeFields = (fields: Fields): Record<string, unknown> =>
	Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]));

export interface FsDoc {
	id: string;
	data: Record<string, unknown>;
}

const idOf = (name: string) => name.slice(name.lastIndexOf("/") + 1);

export class Firestore {
	constructor(private session: Session) {}

	private get base() {
		return `https://firestore.googleapis.com/v1/projects/${this.session.connection.projectId}/databases/(default)/documents`;
	}

	private async headers() {
		return { Authorization: `Bearer ${await this.session.token()}`, "Content-Type": "application/json" };
	}

	async get(path: string): Promise<FsDoc | null> {
		try {
			const doc = await call<{ name: string; fields?: Fields }>(`${this.base}/${path}`, { headers: await this.headers() });
			return { id: idOf(doc.name), data: decodeFields(doc.fields ?? {}) };
		} catch (err) {
			if (err instanceof FirebaseError && err.status === 404) return null;
			throw err;
		}
	}

	/** Every document in a collection (small collections only). */
	async list(collection: string): Promise<FsDoc[]> {
		const body = await call<{ documents?: { name: string; fields?: Fields }[] }>(`${this.base}/${collection}?pageSize=300`, {
			headers: await this.headers(),
		});
		return (body.documents ?? []).map((d) => ({ id: idOf(d.name), data: decodeFields(d.fields ?? {}) }));
	}

	/** Creates or replaces a document. */
	async set(path: string, data: Record<string, unknown>): Promise<void> {
		await call(`${this.base}/${path}`, {
			method: "PATCH",
			headers: await this.headers(),
			body: JSON.stringify({ fields: encodeFields(data) }),
		});
	}

	async delete(path: string): Promise<void> {
		await call(`${this.base}/${path}`, { method: "DELETE", headers: await this.headers() });
	}
}
