import { ACCESS_TOKEN_TTL_S, json, oauthError, preflight } from "@/lib/connector/oauth";
import { pkceChallenge, seal, unseal } from "@/lib/connector/seal";

/** The token endpoint: authorization_code (with PKCE) and refresh_token grants. */
export async function POST(request: Request) {
	const type = request.headers.get("content-type") ?? "";
	const params = type.includes("application/json")
		? new URLSearchParams(Object.entries(((await request.json().catch(() => ({}))) as Record<string, string>) ?? {}))
		: new URLSearchParams(await request.text());
	const grant = params.get("grant_type");
	const clientId = params.get("client_id") ?? "";

	const issue = (rt: string, uid: string, client: string) =>
		json({
			access_token: seal({ t: "access", rt, uid, exp: Date.now() + ACCESS_TOKEN_TTL_S * 1000 }),
			token_type: "Bearer",
			expires_in: ACCESS_TOKEN_TTL_S,
			refresh_token: seal({ t: "refresh", rt, uid, clientId: client }),
			scope: "setsmith",
		});

	if (grant === "authorization_code") {
		const code = unseal(params.get("code"), "code");
		if (!code) return oauthError("invalid_grant", "The code is invalid or has expired.");
		if (code.clientId !== clientId) return oauthError("invalid_grant", "The code was issued to another client.");
		if (code.redirectUri !== params.get("redirect_uri")) return oauthError("invalid_grant", "redirect_uri does not match.");
		const verifier = params.get("code_verifier") ?? "";
		if (!verifier || pkceChallenge(verifier) !== code.challenge) return oauthError("invalid_grant", "PKCE verification failed.");
		return issue(code.rt, code.uid, code.clientId);
	}

	if (grant === "refresh_token") {
		const refresh = unseal(params.get("refresh_token"), "refresh");
		if (!refresh || (clientId && refresh.clientId !== clientId)) return oauthError("invalid_grant", "The refresh token is invalid.");
		return issue(refresh.rt, refresh.uid, refresh.clientId);
	}

	return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
}

export const OPTIONS = preflight;
