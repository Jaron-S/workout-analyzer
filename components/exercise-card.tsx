"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Exercise } from "@/lib/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MuscleWeightingsDialog } from "@/components/muscle-weightings-dialog";
import { GripVertical, Minus, Plus, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

interface ExerciseCardProps {
	id: string;
	exercise: Exercise;
	sets: number;
	onSetsChange: (sets: number) => void;
	onRemove: () => void;
}

export function ExerciseCard({
	id,
	exercise,
	sets,
	onSetsChange,
	onRemove,
}: ExerciseCardProps) {
	const [editingMuscles, setEditingMuscles] = useState(false);
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const incrementSets = () => {
		if (sets < 10) onSetsChange(sets + 1);
	};

	const decrementSets = () => {
		if (sets > 1) onSetsChange(sets - 1);
	};

	return (
		<Card
			ref={setNodeRef}
			style={style}
			className="p-3 bg-secondary/50 border-border hover:bg-secondary/70 transition-colors"
		>
			<div className="flex items-center gap-3">
				<div
					{...attributes}
					{...listeners}
					className="cursor-grab active:cursor-grabbing"
				>
					<GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
				</div>

				{exercise.thumbnailUrl && (
					<img
						src={exercise.thumbnailUrl}
						alt=""
						loading="lazy"
						className="h-10 w-10 rounded-md bg-white object-contain flex-shrink-0"
					/>
				)}

				<div className="flex-1 min-w-0">
					<h4 className="font-medium text-sm text-foreground truncate">
						{exercise.name}
					</h4>
					<div className="flex flex-wrap gap-1 mt-1">
						{exercise.muscle_weightings.slice(0, 3).map((mw, idx) => (
							<Badge key={idx} variant="outline" className="text-xs">
								{mw.muscle}
							</Badge>
						))}
						{exercise.customWeightings && (
							<Badge variant="secondary" className="text-xs">
								Your weightings
							</Badge>
						)}
						{exercise.legacy && (
							<Badge variant="secondary" className="text-xs">
								Not linked to Hevy
							</Badge>
						)}
					</div>
				</div>

				<div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
					<Button
						onClick={decrementSets}
						size="icon"
						variant="outline"
						className="h-7 w-7 sm:h-8 sm:w-8 bg-transparent"
					>
						<Minus className="h-3 w-3" />
					</Button>

					<div className="w-9 sm:w-12 text-center">
						<span className="text-base sm:text-lg font-bold">{sets}</span>
						<p className="text-xs text-muted-foreground hidden sm:block">
							sets
						</p>
					</div>

					<Button
						onClick={incrementSets}
						size="icon"
						variant="outline"
						className="h-7 w-7 sm:h-8 sm:w-8 bg-transparent"
					>
						<Plus className="h-3 w-3" />
					</Button>

					<Button
						onClick={() => setEditingMuscles(true)}
						size="icon"
						variant="ghost"
						className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground"
						aria-label="Edit muscle weightings"
						title="Edit muscle weightings"
					>
						<SlidersHorizontal className="h-4 w-4" />
					</Button>

					<Button
						onClick={onRemove}
						size="icon"
						variant="ghost"
						className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			</div>

			<MuscleWeightingsDialog
				exercise={exercise}
				open={editingMuscles}
				onOpenChange={setEditingMuscles}
			/>
		</Card>
	);
}
