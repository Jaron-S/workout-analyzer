import { json, origin, preflight } from "@/lib/connector/oauth";

/** RFC 8414: where to register, sign in and get tokens. */
export async function GET(request: Request) {
	const base = origin(request);
	return json({
		issuer: base,
		authorization_endpoint: `${base}/oauth/authorize`,
		token_endpoint: `${base}/api/oauth/token`,
		registration_endpoint: `${base}/api/oauth/register`,
		response_types_supported: ["code"],
		grant_types_supported: ["authorization_code", "refresh_token"],
		code_challenge_methods_supported: ["S256"],
		token_endpoint_auth_methods_supported: ["none"],
		scopes_supported: ["setsmith"],
	});
}

export const OPTIONS = preflight;
