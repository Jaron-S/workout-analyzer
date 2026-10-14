import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Session } from "@/lib/connector/firebase-rest";
import { createSetsmithServer } from "@/lib/connector/mcp-server";
import { CORS_HEADERS, preflight, protectedResourceMetadataUrl, serverConnection } from "@/lib/connector/oauth";
import { unseal } from "@/lib/connector/seal";
import { UserStore } from "@/lib/connector/store";

// The Setsmith connector: MCP over streamable HTTP, stateless. Each request
// signs in as the token's user, builds the server, answers, and is done;
// drafts and undo history live with the user's data.

function unauthorized(request: Request) {
	return new Response(JSON.stringify({ error: "invalid_token", error_description: "Sign in to Setsmith to use this connector." }), {
		status: 401,
		headers: {
			...CORS_HEADERS,
			"Content-Type": "application/json",
			"WWW-Authenticate": `Bearer resource_metadata="${protectedResourceMetadataUrl(request)}"`,
		},
	});
}

async function handle(request: Request) {
	const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
	const access = unseal(bearer, "access");
	if (!access) return unauthorized(request);

	const session = new Session(serverConnection(), access.rt);
	try {
		await session.token();
	} catch {
		return unauthorized(request); // revoked or expired Firebase session
	}

	const server = createSetsmithServer(new UserStore(session));
	const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
	await server.connect(transport);
	const response = await transport.handleRequest(request);
	const headers = new Headers(response.headers);
	for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
	return new Response(response.body, { status: response.status, headers });
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export const OPTIONS = preflight;
