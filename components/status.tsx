import { TIER_CLASSES, TONE_CLASSES, ZONES, type Tone, type VolumeZone } from "@/lib/design";
import type { PriorityTier, VolumeLandmark } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TierBadge({ tier, className }: { tier: PriorityTier; className?: string }) {
	return (
		<span
			className={cn(
				"inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-[11px] font-bold leading-none",
				TIER_CLASSES[tier],
				className
			)}
			title={`${tier}-tier priority`}
		>
			{tier}
		</span>
	);
}

export function ToneBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
	const t = TONE_CLASSES[tone];
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
				t.soft,
				t.text,
				className
			)}
		>
			<span className={cn("h-1.5 w-1.5 rounded-full", t.fill)} />
			{children}
		</span>
	);
}

export function ZoneBadge({ zone, className }: { zone: VolumeZone; className?: string }) {
	return (
		<ToneBadge tone={ZONES[zone].tone} className={className}>
			{ZONES[zone].label}
		</ToneBadge>
	);
}

/**
 * Weekly sets against a muscle's landmarks: the track runs past MRV, the
 * MEV to MAV range is shaded with the MAV sweet spot stronger, ticks mark MV
 * and MRV, and the fill shows the current volume in its status colour.
 */
export function VolumeBar({
	sets,
	landmarks,
	tone,
	target,
	className,
}: {
	sets: number;
	landmarks: VolumeLandmark;
	tone: Tone;
	/** Highlight a different target range (e.g. a tier's goal) instead of MEV to MAV. */
	target?: [number, number];
	className?: string;
}) {
	const max = Math.max(landmarks.mrv * 1.15, sets * 1.05);
	const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
	const [bandMin, bandMax] = target ?? [landmarks.mev, landmarks.mav_max];
	return (
		<div className={cn("relative h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}>
			<div
				className="absolute inset-y-0 bg-status-optimal/15"
				style={{ left: pct(bandMin), width: `calc(${pct(bandMax)} - ${pct(bandMin)})` }}
			/>
			{!target && (
				<div
					className="absolute inset-y-0 bg-status-optimal/25"
					style={{ left: pct(landmarks.mav_min), width: `calc(${pct(landmarks.mav_max)} - ${pct(landmarks.mav_min)})` }}
				/>
			)}
			<div
				className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out", TONE_CLASSES[tone].fill)}
				style={{ width: pct(sets) }}
			/>
			{[landmarks.mv, landmarks.mrv].map((n) => (
				<div key={n} className="absolute inset-y-0 w-px bg-foreground/25" style={{ left: pct(n) }} />
			))}
		</div>
	);
}

export function VolumeLegend({ className }: { className?: string }) {
	return (
		<div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground", className)}>
			<span className="inline-flex items-center gap-1.5">
				<span className="h-2 w-4 rounded-sm bg-status-optimal/25" />
				Sweet spot (MAV)
			</span>
			<span className="inline-flex items-center gap-1.5">
				<span className="h-2 w-4 rounded-sm bg-status-optimal/12" />
				Productive (MEV+)
			</span>
			<span className="inline-flex items-center gap-1.5">
				<span className="h-3 w-px bg-foreground/40" />
				Maintenance (MV) / limit (MRV)
			</span>
		</div>
	);
}
