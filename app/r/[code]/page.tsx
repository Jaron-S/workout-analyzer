import { Home } from "@/components/home";
import { decodeRoutine } from "@/lib/share";
import type { Metadata } from "next";

type Props = { params: Promise<{ code: string }> };

// A shared routine link previews as that routine's own card.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { code } = await params;
	try {
		const routine = await decodeRoutine(code);
		const title = `${routine.name} · Setsmith`;
		const description = `A ${routine.days.length}-day training routine. Open it in Setsmith to see the volume for every muscle, tweak it, and push it to Hevy.`;
		const image = { url: `/api/routine-image?r=${code}`, width: 1200, height: 630, alt: routine.name };
		return {
			title: { absolute: title },
			description,
			openGraph: { title, description, images: [image] },
			twitter: { card: "summary_large_image", title, description, images: [image.url] },
		};
	} catch {
		return {};
	}
}

export default async function SharedRoutinePage({ params }: Props) {
	const { code } = await params;
	return <Home sharedCode={code} />;
}
