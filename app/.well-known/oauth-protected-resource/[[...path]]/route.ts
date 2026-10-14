import { json, origin, preflight, resourceUrl } from "@/lib/connector/oauth";

/** RFC 9728: tells Claude which authorization server guards the connector. */
export async function GET(request: Request) {
	return json({
		resource: resourceUrl(request),
		authorization_servers: [origin(request)],
		bearer_methods_supported: ["header"],
		resource_name: "Setsmith",
	});
}

export const OPTIONS = preflight;
