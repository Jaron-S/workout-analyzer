import { buildCatalog } from "@/lib/exercise-catalog";
import { decodeRoutine } from "@/lib/share";
import { calculateMuscleVolumes } from "@/lib/volume-calculator";
import { ImageResponse } from "next/og";

// A 1200x630 card for a shared routine: the link preview on Reddit and
// elsewhere, and the image people download from the share dialog.

const AMBER = "#F59E0B";
const MUTED = "#a8a29e";
const catalog = new Map(buildCatalog({}).map((e) => [e.id, e]));

export async function GET(request: Request) {
	const code = new URL(request.url).searchParams.get("r") ?? "";
	let routine;
	try {
		routine = await decodeRoutine(code);
	} catch {
		return new Response("Invalid routine link", { status: 400 });
	}

	const exercises = [...catalog.values()];
	const volumes = calculateMuscleVolumes(routine, exercises)
		.filter((v) => v.totalSets > 0)
		.sort((a, b) => b.totalSets - a.totalSets)
		.slice(0, 6);
	const weeklySets = routine.days.reduce((n, d) => n + d.exercises.reduce((m, e) => m + e.sets, 0), 0);
	const days = routine.days.slice(0, 6);
	// Day cards fill a 668px-wide area: two columns up to four days, then three.
	const columns = days.length > 4 ? 3 : 2;
	const cardWidth = Math.floor((668 - 16 * (columns - 1)) / columns);
	const perDay = days.length > columns ? 6 : 12;
	const maxSets = Math.max(20, ...volumes.map((v) => v.totalSets));

	return new ImageResponse(
		(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					background: "linear-gradient(135deg, #1c1917 0%, #0c0a09 100%)",
					color: "#fafaf9",
					padding: 56,
					gap: 40,
					fontFamily: "sans-serif",
				}}
			>
				<div style={{ display: "flex", flexDirection: "column", width: 380, justifyContent: "space-between" }}>
					<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
						<div style={{ display: "flex", alignItems: "center", gap: 12, color: AMBER, fontSize: 26, fontWeight: 700 }}>
							<svg width="40" height="40" viewBox="0 0 32 32" fill={AMBER}>
								<rect x="5" y="2.5" width="2.5" height="9.5" rx="1" />
								<rect x="8" y="4.25" width="2" height="6" rx="0.75" />
								<rect x="24" y="4.25" width="2" height="6" rx="0.75" />
								<rect x="26.5" y="2.5" width="2.5" height="9.5" rx="1" />
								<rect x="9.5" y="6.5" width="15" height="1.5" rx="0.5" />
								<path d="M1.5 13.5H29v3a1 1 0 0 1-1 1h-5l-1.5 3h3a1.5 1.5 0 0 1 1.5 1.5v3.5H9.5V22a1.5 1.5 0 0 1 1.5-1.5h3l-1.5-3H9C5.5 17.5 3 16 1.5 13.5Z" />
							</svg>
							Setsmith
						</div>
						<div style={{ fontSize: routine.name.length > 16 ? 40 : 52, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1 }}>
							{routine.name.slice(0, 40)}
						</div>
						<div style={{ fontSize: 24, color: MUTED }}>
							{`${routine.days.length} days a week · ${weeklySets} sets`}
						</div>
					</div>
					<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
						{volumes.map((v) => (
							<div key={v.muscle} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
								<div style={{ display: "flex", justifyContent: "space-between", fontSize: 19 }}>
									<span>{v.muscle}</span>
									<span style={{ color: MUTED }}>{`${v.totalSets.toFixed(1)} sets`}</span>
								</div>
								<div style={{ display: "flex", height: 8, borderRadius: 4, background: "rgba(255,255,255,0.08)" }}>
									<div style={{ width: `${(v.totalSets / maxSets) * 100}%`, borderRadius: 4, background: AMBER }} />
								</div>
							</div>
						))}
					</div>
				</div>
				<div style={{ display: "flex", flexWrap: "wrap", gap: 16, flex: 1, alignContent: "flex-start" }}>
					{days.map((day) => (
						<div
							key={day.id}
							style={{
								display: "flex",
								flexDirection: "column",
								gap: 8,
								width: cardWidth,
								padding: 18,
								borderRadius: 18,
								background: "rgba(255,255,255,0.05)",
								border: "1px solid rgba(255,255,255,0.08)",
							}}
						>
							<div style={{ fontSize: 22, fontWeight: 700 }}>{day.name.slice(0, 24)}</div>
							{day.exercises.slice(0, perDay).map((ex, i) => (
								<div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 16, color: "#d6d3d1" }}>
									<span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: cardWidth - 70 }}>
										{catalog.get(ex.exerciseId)?.name ?? "Exercise"}
									</span>
									<span style={{ color: MUTED }}>{`${ex.sets}×`}</span>
								</div>
							))}
							{day.exercises.length > perDay && (
								<div style={{ fontSize: 15, color: MUTED }}>{`+${day.exercises.length - perDay} more`}</div>
							)}
						</div>
					))}
				</div>
			</div>
		),
		{
			width: 1200,
			height: 630,
			headers: { "Cache-Control": "public, max-age=31536000, immutable" },
		}
	);
}
