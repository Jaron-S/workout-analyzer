"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ALL_MUSCLES } from "@/lib/constants";
import { useExercises } from "@/lib/exercise-context";
import type { Exercise } from "@/lib/types";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

interface MuscleWeightingsDialogProps {
	exercise: Exercise;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const toRecord = (exercise: Exercise) =>
	Object.fromEntries(exercise.muscle_weightings.map((mw) => [mw.muscle, mw.weighting]));

export function MuscleWeightingsDialog({
	exercise,
	open,
	onOpenChange,
}: MuscleWeightingsDialogProps) {
	const { setMuscleOverride, hasMuscleOverride } = useExercises();
	const [muscles, setMuscles] = useState<Record<string, number>>(() => toRecord(exercise));

	useEffect(() => {
		if (open) setMuscles(toRecord(exercise));
	}, [open, exercise]);

	const unused = ALL_MUSCLES.filter((m) => !(m in muscles));
	const entries = Object.entries(muscles).sort((a, b) => b[1] - a[1]);

	const save = () => {
		setMuscleOverride(exercise.id, muscles);
		onOpenChange(false);
	};

	const reset = () => {
		setMuscleOverride(exercise.id, null);
		onOpenChange(false);
	};

	const removeMuscle = (muscle: string) =>
		setMuscles((prev) => {
			const next = { ...prev };
			delete next[muscle];
			return next;
		});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>{exercise.name}</DialogTitle>
					<DialogDescription>
						How hard each muscle works in this exercise for you. At 100% a set
						counts as a full set for that muscle; at 50%, half a set.
						{exercise.estimatedWeightings &&
							" These were estimated from Hevy's muscle groups, so check them."}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{entries.map(([muscle, weighting]) => (
						<div key={muscle} className="flex items-center gap-3">
							<span className="w-24 text-sm shrink-0">{muscle}</span>
							<Slider
								value={[weighting]}
								min={0.1}
								max={1}
								step={0.1}
								onValueChange={([value]) =>
									setMuscles((prev) => ({ ...prev, [muscle]: value }))
								}
								className="flex-1"
							/>
							<span className="w-10 text-right text-sm tabular-nums">
								{Math.round(weighting * 100)}%
							</span>
							<Button
								size="icon"
								variant="ghost"
								className="h-7 w-7 text-muted-foreground"
								onClick={() => removeMuscle(muscle)}
								aria-label={`Remove ${muscle}`}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					))}

					{unused.length > 0 && (
						<Select
							value=""
							onValueChange={(muscle) =>
								setMuscles((prev) => ({ ...prev, [muscle]: 0.5 }))
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Add a muscle" />
							</SelectTrigger>
							<SelectContent>
								{unused.map((muscle) => (
									<SelectItem key={muscle} value={muscle}>
										{muscle}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>

				<DialogFooter className="gap-2 sm:justify-between">
					{hasMuscleOverride(exercise.id) ? (
						<Button variant="ghost" onClick={reset}>
							Reset to default
						</Button>
					) : (
						<span />
					)}
					<div className="flex gap-2">
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button onClick={save} disabled={entries.length === 0}>
							Save
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
