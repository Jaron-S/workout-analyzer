"use client";

import { Thumb } from "@/components/exercise-card";
import { ExerciseTierBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useExercises } from "@/lib/exercise-context";
import { namedDifferently, type RankingEntry } from "@/lib/exercise-rankings";
import type { Exercise } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Ban, Check, Heart, NotebookPen } from "lucide-react";
import { useEffect, useState } from "react";

interface ExerciseInfoDialogProps {
	exercise: Exercise | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Set when the exercise is in the routine: adds a cue to its notes. */
	onAddCue?: (cue: string) => void;
}

const MAX_CUE = 280;

/** The execution cue, cut to whole sentences that fit a Hevy note. */
export function shortCue(entry: RankingEntry): string {
	const text = entry.cues?.execution ?? entry.cues?.setup ?? "";
	let cue = "";
	for (const sentence of text.match(/[^.!?]+[.!?]+/g) ?? [text]) {
		if ((cue + sentence).trim().length > MAX_CUE) break;
		cue += sentence;
	}
	return (cue || text.slice(0, MAX_CUE)).trim();
}

/** An exercise's tiers, form cues and the user's preference for it. */
export function ExerciseInfoDialog({ exercise, open, onOpenChange, onAddCue }: ExerciseInfoDialogProps) {
	const { rankings, preferences, setPreference } = useExercises();
	const preference = exercise ? preferences[exercise.id] : undefined;
	const [note, setNote] = useState(preference?.note ?? "");
	const [added, setAdded] = useState<string | null>(null);

	useEffect(() => {
		if (open) {
			setNote(preference?.note ?? "");
			setAdded(null);
		}
		// Only when opening: typing shouldn't be reset by the save it causes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, exercise?.id]);

	if (!exercise) return null;
	const ranks = rankings.forExercise(exercise.id);
	const withCues = [...new Set(ranks.flatMap((r) => r.entries))].filter((e) => e.cues);

	const toggle = (pref: "favourite" | "avoid") =>
		setPreference(exercise.id, preference?.pref === pref ? null : { pref, ...(pref === "avoid" && note.trim() ? { note: note.trim() } : {}) });
	const saveNote = () => {
		if (preference?.pref === "avoid" && (preference.note ?? "") !== note.trim()) {
			setPreference(exercise.id, { pref: "avoid", ...(note.trim() ? { note: note.trim() } : {}) });
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[88dvh] gap-5 overflow-y-auto sm:max-w-lg">
				<DialogHeader className="flex-row items-center gap-3 space-y-0 text-left">
					<Thumb exercise={exercise} className="h-12 w-12" />
					<div className="min-w-0">
						<DialogTitle className="leading-snug">{exercise.name}</DialogTitle>
						<DialogDescription className="text-xs">
							{exercise.muscle_weightings
								.slice(0, 3)
								.map((w) => (w.weighting < 1 ? `${w.muscle} ${Math.round(w.weighting * 100)}%` : w.muscle))
								.join(" · ") || "No muscle volume"}
						</DialogDescription>
					</div>
				</DialogHeader>

				<section className="space-y-2">
					<div className="grid grid-cols-2 gap-2">
						<Button
							variant={preference?.pref === "favourite" ? "default" : "outline"}
							onClick={() => toggle("favourite")}
							aria-pressed={preference?.pref === "favourite"}
						>
							<Heart className={cn("h-4 w-4", preference?.pref === "favourite" && "fill-current")} />
							Favourite
						</Button>
						<Button
							variant="outline"
							onClick={() => toggle("avoid")}
							aria-pressed={preference?.pref === "avoid"}
							className={cn(preference?.pref === "avoid" && "border-status-under/50 bg-status-under/10 text-status-under hover:bg-status-under/15 hover:text-status-under")}
						>
							<Ban className="h-4 w-4" />
							Avoid
						</Button>
					</div>
					<p className="text-xs text-muted-foreground">
						{preference?.pref === "avoid"
							? "Setsmith won't suggest it, and Claude won't add it unless you ask."
							: preference?.pref === "favourite"
								? "Suggested first for the muscles it trains."
								: "Favourites are suggested first; avoided exercises never are."}
					</p>
					{preference?.pref === "avoid" && (
						<Input
							value={note}
							onChange={(e) => setNote(e.target.value)}
							onBlur={saveNote}
							onKeyDown={(e) => e.key === "Enter" && saveNote()}
							maxLength={200}
							placeholder="Why? e.g. hard on my lower back (Claude reads this)"
							aria-label="Why you avoid it"
						/>
					)}
				</section>

				<section className="space-y-2">
					<h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tier</h3>
					{ranks.length ? (
						<ul className="space-y-2">
							{ranks.map((r) => (
								<li key={r.muscle} className="flex gap-2.5 text-sm">
									<ExerciseTierBadge tier={r.tier} muscle={r.muscle} />
									<div className="min-w-0">
										<p>
											<span className="font-medium">{r.muscle}</span>
											{namedDifferently(r.entry, exercise.name) && (
												<span className="text-muted-foreground"> · ranked as {r.entry.name}</span>
											)}
										</p>
										{r.entry.note && <p className="text-xs text-muted-foreground">{r.entry.note}</p>}
										{r.better.length > 0 && (
											<p className="text-xs text-muted-foreground">
												Better: {r.better.map((b) => `${b.name} (${b.tier})`).join(", ")}
											</p>
										)}
									</div>
								</li>
							))}
						</ul>
					) : (
						<p className="text-sm text-muted-foreground">
							Not on the tier lists, which cover chest, back, shoulders, arms, glutes and quads.
						</p>
					)}
				</section>

				{withCues.length > 0 && (
					<section className="space-y-3">
						<h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Form cues</h3>
						{withCues.map((entry) => (
							<div key={entry.name} className="space-y-1.5 rounded-xl bg-surface p-3 text-sm">
								{withCues.length > 1 || namedDifferently(entry, exercise.name) ? <p className="font-medium">{entry.name}</p> : null}
								{entry.cues?.setup && (
									<p>
										<span className="font-medium text-brand-text">Setup </span>
										{entry.cues.setup}
									</p>
								)}
								{entry.cues?.execution && (
									<p>
										<span className="font-medium text-brand-text">Execution </span>
										{entry.cues.execution}
									</p>
								)}
								{onAddCue && (
									<Button
										size="sm"
										variant="secondary"
										className="mt-1"
										disabled={added === entry.name}
										onClick={() => {
											onAddCue(shortCue(entry));
											setAdded(entry.name);
										}}
									>
										{added === entry.name ? <Check className="h-4 w-4" /> : <NotebookPen className="h-4 w-4" />}
										{added === entry.name ? "Added to notes" : "Add cue to notes"}
									</Button>
								)}
							</div>
						))}
						{onAddCue && <p className="text-xs text-muted-foreground">Notes show in Hevy during your workout.</p>}
					</section>
				)}
			</DialogContent>
		</Dialog>
	);
}
