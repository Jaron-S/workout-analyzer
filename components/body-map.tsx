"use client";

import { TONE_VAR, type Tone } from "@/lib/design";
import { cn } from "@/lib/utils";

/**
 * Front and back figures with each tracked muscle coloured by its weekly
 * volume status. Regions are drawn for one side on a 100 x 220 grid and
 * mirrored across x = 50.
 */

type Region = { muscle: string; d: string };

// Shapes for the figure's right side (x >= 50); each is mirrored.
const FRONT: Region[] = [
	{ muscle: "Neck", d: "M50 27h4.5v7.5c-1.5.6-3 .8-4.5.8Z" },
	{ muscle: "Traps", d: "M54.5 31.5c3.5 2.4 8 4.4 12.5 5.6l-6.5 2.4c-2.3-.6-4.3-1.6-6-3Z" },
	{ muscle: "Front Delts", d: "M61 40.5c3.6-1.7 7.6-1.9 10.5-.4 1.4 2.8 1.6 6.6.8 10.4-3.4-1.4-6.7-4.6-11.3-10Z" },
	{ muscle: "Side Delts", d: "M71.8 40.3c3.3 1.1 5.5 4.4 5.7 9.2.1 1.6-.2 3-.7 4.3-1.3-1.6-2.6-2.4-4-3 .7-3.8.5-7.5-1-10.5Z" },
	{ muscle: "Chest", d: "M50.8 41.5c3.2-1.7 6.6-2.3 10-1.3 4 4.7 7.4 8.5 11 10.1-1.6 4.8-5 8.6-9.7 9.6-4.2.8-8.4.2-11.3-1.4Z" },
	{ muscle: "Biceps", d: "M72.6 52.6c1.6.6 3 1.6 4.2 3.2 1.1 4.4 1.2 9.2.3 13.6-1.9 1.2-4 1.4-5.9.6-1.5-4.4-1.5-9.3-.3-13.8.4-1.3 1-2.5 1.7-3.6Z" },
	{ muscle: "Forearms", d: "M71.6 72.2c2.1.6 4.3.5 6.1-.7 2.3 3.6 3.9 9.4 4.4 15.6l.4 8.6c-1 .7-2.2 1-3.4.9-2.6-5.5-5.4-12.4-7.4-19.4Z" },
	{ muscle: "Abs", d: "M51 61c3 1.3 6.5 1.6 9.6 1.1.8 6.8.9 14.4.4 21.4-.4 6-1.6 11.4-3.7 15.5-2 .9-4.2 1.3-6.3 1.2Z" },
	{ muscle: "Abductors", d: "M62.4 90.5c1.5 4.4 2.6 8.8 3.5 13.3-1.6.7-3.2 1-4.8.9.1-4.6.5-9.4 1.3-14.2Z" },
	{ muscle: "Adductors", d: "M50.8 106c2.3-.6 4.3-1.9 6-3.6.8 6.4.6 13.3-.4 20.4l-1.4 9c-1.6-.4-3-1.2-4.2-2.3Z" },
	{ muscle: "Quads", d: "M57.8 101.5c2.2-.8 4.8-1.1 7.6-.6 2.8 6.2 4.2 14 4 22.2-.2 8.6-1.8 16.4-4.2 22.5-2.5 1.2-5.3 1.4-8 .5-.9-7.5-.8-15.2.2-22.6.6-7.8.8-15.2.4-22Z" },
	{ muscle: "Calves", d: "M58.4 156.8c2.4.6 4.9.6 7.3-.2 1.7 6.4 2.3 13 1.6 19.7-.6 5.6-1.9 10.6-3.8 14.5-1.5.4-3 .3-4.4-.2-.8-6.2-1.1-12.6-1-19 .1-5 .1-10-.3-14.8Z" },
];

const BACK: Region[] = [
	{ muscle: "Neck", d: "M50 27h4.5v5.5c-1.5.4-3 .5-4.5.5Z" },
	{ muscle: "Traps", d: "M50 32.5c2.2 0 4.5-.5 6.6-1.3 3.4 2.5 7.4 4.5 11.2 5.7-4.4 2.4-8 5.8-10.6 10.3-2.1 4.3-4.5 8.4-7.2 12.3Z" },
	{ muscle: "Rear Delts", d: "M66.4 39.2c2.4-.6 5-.4 7.4.6 1.6 2.6 2.4 5.6 2.4 9-3.6-1.4-7-4.6-9.8-9.6Z" },
	{ muscle: "Side Delts", d: "M74.5 40.2c2.1 1.5 3.3 4.4 3.3 8.6 0 1.7-.3 3.3-.9 4.8l-1-4.5c0-3.3-.6-6.3-1.4-8.9Z" },
	{ muscle: "Middle Back", d: "M57.8 48.4c2.3-3.4 5.2-6.1 8.7-7.9 2.7 4.6 5.8 8 9.2 9.6-2.9 3.5-6.6 6-11 7.2-2.6.7-5 1.8-7.1 3.4.1-4.2.2-8.4.2-12.3Z" },
	{ muscle: "Lats", d: "M57.3 63.4c2.5-1.8 5.4-3.1 8.5-3.8 3.5-1 6.5-2.6 9-4.8.6 4.8-.3 9.9-2.6 14.6-2.8 5.6-6.9 10.3-11.9 13.6-1.3-1.4-2.4-3.1-3.2-5.1-.4-4.8-.3-9.6.2-14.5Z" },
	{ muscle: "Triceps", d: "M72.3 53.4c1.7.4 3.3 1.3 4.6 2.6 1.4 4.5 1.5 9.3.6 13.7-1.9 1-4 1.2-5.9.6-1.5-3.6-1.9-7.5-1.2-11.4.4-2 1-3.8 1.9-5.5Z" },
	{ muscle: "Forearms", d: "M71.6 72.2c2.1.6 4.3.5 6.1-.7 2.3 3.6 3.9 9.4 4.4 15.6l.4 8.6c-1 .7-2.2 1-3.4.9-2.6-5.5-5.4-12.4-7.4-19.4Z" },
	{ muscle: "Lower Back", d: "M50 66c1.7 0 3.3-.4 4.6-1.4.3 5.9 1.2 11.6 2.8 17.2-.4 4.7-1.6 9-3.6 12.8-1.2.5-2.5.7-3.8.7Z" },
	{ muscle: "Abductors", d: "M58 90.6c3.1-.9 5.7-2.3 7.8-4.2.9 3.4 1.2 6.9.9 10.4-2.8.2-5.6.9-8.3 2-.4-2.7-.5-5.5-.4-8.2Z" },
	{ muscle: "Glutes", d: "M50.4 98.6c2.4-.5 4.6-1.4 6.7-2.8 3.3-1.8 6.6-2.4 9.8-1.6 1.6 4.8 1.9 9.8 1 14.7-2.6 3.6-6.2 5.6-10.6 5.8-2.6.1-5-.6-6.9-2.2Z" },
	{ muscle: "Hamstrings", d: "M51.2 117.2c2 1.3 4.4 1.9 7 1.8 3.7-.2 7-1.6 9.8-4 1.3 9.5.8 19.3-1.6 28.4-.6 2.5-1.6 4.7-2.8 6.6-2.7.8-5.4.9-8.1.3-2.4-7.6-3.8-15.5-4.3-23.4Z" },
	{ muscle: "Calves", d: "M57.8 156.4c2.6.9 5.4.9 8.1 0 2.2 5 3.3 10.5 3 16.2-.2 4.4-1.3 8.6-3 12.4-2.2 1-4.5 1-6.8.2-1.3-4.6-2-9.3-2.1-14-.1-5 .2-10 .8-14.8Z" },
];

// The parts that aren't tracked muscles, so the figure reads as a body.
const SILHOUETTE =
	"M50 4.5c6.6 0 11 4.8 11 11.5 0 5.2-2.4 9.4-6.5 11v4.8c4.3 3 9.7 5.1 15.6 6.4 5.4 1.2 8.4 5.6 8.6 11.8.6 6.4 1.3 12.8 3.2 19.6 2.3 6.7 4 14.2 4.5 21.6l.9 9.6c.3 2.6-2.8 3.5-4 1.2-3.3-6.2-6.3-13.4-8.7-20.4-1.9-3.3-3.4-7-4.5-11-.8 6.6-1.5 13.5-1.7 20.7 2.3 5.5 4 11.8 4.4 18.6.5 10-1 19.6-3.8 28.2.9 4.6 1.5 9.4 1.7 14.2.5 8-.6 15.6-3 22.4l-.3 6.8c.3 2.6-1 4.2-3.6 4.2h-4.4c-1.7 0-2.6-1.3-2.4-2.9l.7-5.4c-1.6-6.8-2.4-13.6-2.4-20.3l.2-11.4c-1.4-7.2-2-14.6-1.8-22.2l-.5-9.6h-1.4ZM50 4.5c-6.6 0-11 4.8-11 11.5 0 5.2 2.4 9.4 6.5 11v4.8c-4.3 3-9.7 5.1-15.6 6.4-5.4 1.2-8.4 5.6-8.6 11.8-.6 6.4-1.3 12.8-3.2 19.6-2.3 6.7-4 14.2-4.5 21.6l-.9 9.6c-.3 2.6 2.8 3.5 4 1.2 3.3-6.2 6.3-13.4 8.7-20.4 1.9-3.3 3.4-7 4.5-11 .8 6.6 1.5 13.5 1.7 20.7-2.3 5.5-4 11.8-4.4 18.6-.5 10 1 19.6 3.8 28.2-.9 4.6-1.5 9.4-1.7 14.2-.5 8 .6 15.6 3 22.4l.3 6.8c-.3 2.6 1 4.2 3.6 4.2h4.4c1.7 0 2.6-1.3 2.4-2.9l-.7-5.4c1.6-6.8 2.4-13.6 2.4-20.3l-.2-11.4c1.4-7.2 2-14.6 1.8-22.2l.5-9.6h1.4Z";

export type MuscleTones = Partial<Record<string, Tone | null>>;

function Figure({
	regions,
	tones,
	label,
	onHover,
	active,
}: {
	regions: Region[];
	tones: MuscleTones;
	label: string;
	onHover: (muscle: string | null) => void;
	active: string | null;
}) {
	return (
		<figure className="flex flex-col items-center gap-1">
			<svg viewBox="0 0 100 220" className="h-auto w-full max-w-[150px]" role="img" aria-label={`${label} muscles`}>
				<path d={SILHOUETTE} className="fill-muted stroke-muted stroke-[0.8]" />
				{regions.flatMap(({ muscle, d }) =>
					[false, true].map((mirror) => {
						const tone = tones[muscle];
						return (
							<path
								key={`${muscle}-${mirror}`}
								d={d}
								transform={mirror ? "matrix(-1 0 0 1 100 0)" : undefined}
								style={{ fill: tone ? TONE_VAR[tone] : undefined }}
								className={cn(
									"cursor-pointer stroke-background stroke-[0.6] transition-[fill,opacity] duration-300",
									!tone && "fill-foreground/10",
									active && active !== muscle && "opacity-40"
								)}
								onMouseEnter={() => onHover(muscle)}
								onMouseLeave={() => onHover(null)}
								onClick={() => onHover(active === muscle ? null : muscle)}
							>
								<title>{muscle}</title>
							</path>
						);
					})
				)}
			</svg>
			<figcaption className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</figcaption>
		</figure>
	);
}

export function BodyMap({
	tones,
	active,
	onActiveChange,
	className,
}: {
	tones: MuscleTones;
	active: string | null;
	onActiveChange: (muscle: string | null) => void;
	className?: string;
}) {
	return (
		<div className={cn("grid grid-cols-2 gap-2", className)}>
			<Figure regions={FRONT} tones={tones} label="Front" onHover={onActiveChange} active={active} />
			<Figure regions={BACK} tones={tones} label="Back" onHover={onActiveChange} active={active} />
		</div>
	);
}
