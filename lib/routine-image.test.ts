import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/routine-image/route";
import { encodeRoutine } from "./share";
import { TEMPLATES, routineFromTemplate } from "./templates";

describe("routine share image", () => {
	it("renders a PNG for a shared routine", async () => {
		const { code } = await encodeRoutine(routineFromTemplate(TEMPLATES[1]));
		const res = await GET(new Request(`http://x/api/routine-image?r=${code}`));
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("image/png");
		// Rendering is lazy: reading the body is what surfaces layout errors.
		const bytes = new Uint8Array(await res.arrayBuffer());
		expect([...bytes.slice(1, 4)].map((b) => String.fromCharCode(b)).join("")).toBe("PNG");
	}, 30000);

	it("rejects a bad code", async () => {
		const res = await GET(new Request("http://x/api/routine-image?r=nope!"));
		expect(res.status).toBe(400);
	});
});
