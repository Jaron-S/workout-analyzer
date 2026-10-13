import { ImageResponse } from "next/og";

// The preview shown when a link is shared (Reddit, Discord, iMessage...).
export const alt = "Setsmith: forge your training week";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const AMBER = "#F59E0B";

// Illustrative weekly volume bars: [muscle, sets, status colour].
const BARS: [string, number, string][] = [
	["Chest", 14, "#34d399"],
	["Side Delts", 16, "#34d399"],
	["Lats", 11, "#7dd3fc"],
	["Quads", 12, "#34d399"],
	["Hamstrings", 7, "#7dd3fc"],
	["Biceps", 5, "#a8a29e"],
];

export default function OpengraphImage() {
	return new ImageResponse(
		(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					background: "linear-gradient(135deg, #1c1917 0%, #0c0a09 100%)",
					color: "#fafaf9",
					padding: 72,
					fontFamily: "sans-serif",
				}}
			>
				<div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 560 }}>
					<div style={{ display: "flex", alignItems: "center", gap: 20 }}>
						<svg width="88" height="88" viewBox="0 0 32 32" fill={AMBER}>
							<rect x="5" y="2.5" width="2.5" height="9.5" rx="1" />
							<rect x="8" y="4.25" width="2" height="6" rx="0.75" />
							<rect x="24" y="4.25" width="2" height="6" rx="0.75" />
							<rect x="26.5" y="2.5" width="2.5" height="9.5" rx="1" />
							<rect x="9.5" y="6.5" width="15" height="1.5" rx="0.5" />
							<path d="M1.5 13.5H29v3a1 1 0 0 1-1 1h-5l-1.5 3h3a1.5 1.5 0 0 1 1.5 1.5v3.5H9.5V22a1.5 1.5 0 0 1 1.5-1.5h3l-1.5-3H9C5.5 17.5 3 16 1.5 13.5Z" />
						</svg>
						<span style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2 }}>Setsmith</span>
					</div>
					<div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
						<span style={{ fontSize: 48, fontWeight: 700, lineHeight: 1.1 }}>
							Forge your training week.
						</span>
						<span style={{ fontSize: 28, color: "#a8a29e", lineHeight: 1.4 }}>
							Live volume analysis for every muscle, routines built with Claude, pushed straight to Hevy.
						</span>
					</div>
				</div>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						justifyContent: "center",
						gap: 22,
						marginLeft: 64,
						flex: 1,
						padding: 36,
						borderRadius: 28,
						background: "rgba(255,255,255,0.04)",
						border: "1px solid rgba(255,255,255,0.08)",
					}}
				>
					{BARS.map(([muscle, sets, color]) => (
						<div key={muscle} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
							<div style={{ display: "flex", justifyContent: "space-between", fontSize: 22 }}>
								<span>{muscle}</span>
								<span style={{ color: "#a8a29e" }}>{`${sets} sets`}</span>
							</div>
							<div style={{ display: "flex", height: 12, borderRadius: 6, background: "rgba(255,255,255,0.08)" }}>
								<div style={{ width: `${(sets / 20) * 100}%`, borderRadius: 6, background: color }} />
							</div>
						</div>
					))}
				</div>
			</div>
		),
		size
	);
}
