import { isAllowedRedirectUri, json, oauthError, preflight } from "@/lib/connector/oauth";
import { seal } from "@/lib/connector/seal";

/**
 * RFC 7591 dynamic client registration. Nothing is stored: the client id is
 * the sealed registration itself, so the authorize step can check redirect
 * URIs against it.
 */
export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as { redirect_uris?: unknown; client_name?: unknown } | null;
	const redirectUris = Array.isArray(body?.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
	if (redirectUris.length === 0 || redirectUris.length > 10 || !redirectUris.every(isAllowedRedirectUri)) {
		return oauthError("invalid_redirect_uri", "Provide 1–10 redirect URIs: https, or http on localhost.");
	}
	const name = typeof body?.client_name === "string" && body.client_name.trim() ? body.client_name.trim().slice(0, 80) : "An app";
	return json(
		{
			client_id: seal({ t: "client", redirectUris, name }),
			client_id_issued_at: Math.floor(Date.now() / 1000),
			client_name: name,
			redirect_uris: redirectUris,
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			token_endpoint_auth_method: "none",
		},
		201
	);
}

export const OPTIONS = preflight;
