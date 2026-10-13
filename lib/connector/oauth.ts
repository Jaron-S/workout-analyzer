import type { Connection } from "./firebase-rest";

// Shared pieces of the connector's OAuth 2.1 endpoints: the flow Claude uses
// to add a custom connector (discovery, dynamic client registration,
// authorization code with PKCE, refresh). Server-only.

export const ACCESS_TOKEN_TTL_S = 60 * 60;
export const CODE_TTL_MS = 5 * 60_000;

/** The public origin, e.g. https://setsmith.netlify.app. */
export function origin(request: Request): string {
	const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
	if (configured) return configured;
	const url = new URL(request.url);
	const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
	const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
	return `${proto}://${host}`;
}

export const resourceUrl = (request: Request) => `${origin(request)}/api/mcp`;
export const protectedResourceMetadataUrl = (request: Request) => `${origin(request)}/.well-known/oauth-protected-resource`;

/** Firebase as seen from the server, signed in as whichever user a token belongs to. */
export function serverConnection(): Connection {
	return { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID! };
}

/** Redirect URIs a client may register: https anywhere, http only on this machine. */
export function isAllowedRedirectUri(uri: string): boolean {
	try {
		const url = new URL(uri);
		if (url.hash) return false;
		if (url.protocol === "https:") return true;
		return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
	} catch {
		return false;
	}
}

export const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
	"Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
	return Response.json(body, { status, headers: { ...CORS_HEADERS, "Cache-Control": "no-store", ...headers } });
}

export const oauthError = (error: string, description: string, status = 400) =>
	json({ error, error_description: description }, status);

export const preflight = () => new Response(null, { status: 204, headers: CORS_HEADERS });
