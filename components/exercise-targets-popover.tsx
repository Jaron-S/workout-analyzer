"use client";

import { NumberInput, RepRangeInput } from "@/components/settings-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/lib/settings-context";
import { formatReps, formatRest, isTimed, resolveTargets } from "@/lib/training-defaults";
import type { Exercise, RoutineExercise } from "@/lib/types";

interface ExerciseTargetsPopoverProps {
	exercise: Exercise;
	routineExercise: RoutineExercise;
	onChange: (patch: Partial<RoutineExercise>) => void;
}

/** "3 × 8–12 · 2:30 rest", opening an editor for this exercise's own targets. */
export function ExerciseTargetsPopover({
	exercise,
	routineExercise,
	onChange,
}: ExerciseTargetsPopoverProps) {
	const { defaults } = useSettings();
	const targets = resolveTargets(routineExercise, exercise, defaults);
	const timed = isTimed(exercise);
	const hasOwnTargets =
		routineExercise.reps !== undefined ||
		routineExercise.restSeconds !== undefined ||
		routineExercise.durationSeconds !== undefined;

	const summary = [
		`${routineExercise.sets} × ${
			targets.reps ? formatReps(targets.reps) : `${targets.durationSeconds}s`
		}`,
		`${formatRest(targets.restSeconds)} rest`,
	].join(" · ");

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="min-w-0 max-w-full truncate text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
				>
					{summary}
					{routineExercise.notes ? " · note" : ""}
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-80 space-y-3" align="start">
				{timed ? (
					<div className="space-y-1">
						<Label>Seconds per set</Label>
						<NumberInput
							value={targets.durationSeconds!}
							min={5}
							max={3600}
							step={5}
							onChange={(durationSeconds) => onChange({ durationSeconds })}
						/>
					</div>
				) : (
					<div className="space-y-1">
						<Label>Reps</Label>
						<RepRangeInput value={targets.reps!} onChange={(reps) => onChange({ reps })} />
					</div>
				)}
				<div className="space-y-1">
					<Label>Rest (seconds)</Label>
					<NumberInput
						value={targets.restSeconds}
						min={0}
						max={900}
						step={15}
						onChange={(restSeconds) => onChange({ restSeconds })}
					/>
				</div>
				<div className="space-y-1">
					<Label>Notes</Label>
					<Textarea
						rows={2}
						placeholder="Cues, tempo, setup…"
						value={routineExercise.notes ?? ""}
						onChange={(e) => onChange({ notes: e.target.value || undefined })}
					/>
				</div>
				{hasOwnTargets && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() =>
							onChange({ reps: undefined, restSeconds: undefined, durationSeconds: undefined })
						}
					>
						Use my defaults
					</Button>
				)}
			</PopoverContent>
		</Popover>
	);
}
