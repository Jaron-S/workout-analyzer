"use client";

import { useAuth } from "@/lib/auth-context";
import {
	getPrioritiesFromFirebase,
	savePrioritiesToFirebase,
} from "@/lib/firebase-storage";
import {
	DndContext,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";

// UI Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
// App Data & Types
import priorityPresets from "@/data/priority-presets.json";
import { ALL_MUSCLES, PRIORITY_TIERS } from "@/lib/constants";
import type { PriorityTier } from "@/lib/types";
// Icons & Utilities
import { GripVertical, Sparkles } from "lucide-react";
import { toast } from "sonner";

// --- Prop and Constant Definitions ---
interface PrioritySettingsProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	priorities: Partial<Record<PriorityTier, string[]>>;
	onPrioritiesChange: (
		priorities: Partial<Record<PriorityTier, string[]>>
	) => void;
}

const TIER_INFO: Record<
	PriorityTier,
	{ label: string; description: string; color: string }
> = {
	S: {
		label: "S-Tier",
		description: "Highest priority - Target high MAV",
		color: "hsl(0, 70%, 50%)",
	},
	A: {
		label: "A-Tier",
		description: "High priority - Target MAV range",
		color: "hsl(25, 90%, 55%)",
	},
	B: {
		label: "B-Tier",
		description: "Moderate priority - Target MEV-MAV",
		color: "hsl(45, 90%, 55%)",
	},
	C: {
		label: "C-Tier",
		description: "Maintenance - Target above MV",
		color: "hsl(120, 50%, 50%)",
	},
	D: {
		label: "D-Tier",
		description: "Low priority - MV acceptable",
		color: "hsl(210, 70%, 55%)",
	},
	F: {
		label: "F-Tier",
		description: "Avoid - Flag any volume",
		color: "hsl(330, 70%, 60%)",
	},
};

// --- Child Components ---
function SortableMuscle({
	muscle,
	onRemove,
}: {
	muscle: string;
	onRemove: () => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: muscle });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className="flex items-center gap-2 p-2 bg-secondary rounded text-sm border"
			{...attributes}
		>
			<div {...listeners} className="cursor-grab active:cursor-grabbing">
				<GripVertical className="h-4 w-4 text-muted-foreground" />
			</div>
			<span className="flex-1">{muscle}</span>
			<Button
				size="icon"
				variant="ghost"
				className="h-6 w-6"
				onClick={onRemove}
			>
				{" "}
				×{" "}
			</Button>
		</div>
	);
}

// --- Main Component ---
export function PrioritySettings({
	open,
	onOpenChange,
	priorities,
	onPrioritiesChange,
}: PrioritySettingsProps) {
	const { user } = useAuth();
	const [localPriorities, setLocalPriorities] = useState(priorities);
	const [isSaving, setIsSaving] = useState(false);
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);

	useEffect(() => {
		if (open) {
			if (user) {
				getPrioritiesFromFirebase(user.uid).then((fbPriorities) => {
					setLocalPriorities(
						Object.keys(fbPriorities).length > 0 ? fbPriorities : priorities
					);
				});
			} else {
				setLocalPriorities(priorities);
			}
		}
	}, [open, user, priorities]);

	const assignedMuscles = new Set(Object.values(localPriorities).flat());
	const unassignedMuscles = ALL_MUSCLES.filter((m) => !assignedMuscles.has(m));

	const findTierForMuscle = (muscleId: string) => {
		return PRIORITY_TIERS.find((tier) =>
			localPriorities[tier]?.includes(muscleId)
		);
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (!over || active.id === over.id) {
			return;
		}

		const activeId = active.id as string;
		const overId = over.id as string;

		setLocalPriorities((currentPriorities) => {
			const sourceTier = findTierForMuscle(activeId);
			const destinationTier =
				(over.data.current?.sortable?.containerId as PriorityTier) ||
				findTierForMuscle(overId);

			if (!sourceTier || !destinationTier) {
				return currentPriorities;
			}

			// Create fresh copies of the source and destination arrays from the current state
			const sourceItems = [...(currentPriorities[sourceTier] || [])];
			const destinationItems =
				sourceTier === destinationTier
					? sourceItems
					: [...(currentPriorities[destinationTier] || [])];

			// Find the indexes of the active and over items
			const activeIndex = sourceItems.indexOf(activeId);
			const overIndex = destinationItems.indexOf(overId);

			let newPriorities = { ...currentPriorities };

			if (sourceTier === destinationTier) {
				// Reorder within the same container
				newPriorities[sourceTier] = arrayMove(
					sourceItems,
					activeIndex,
					overIndex
				);
			} else {
				// Move to a different container
				// 1. Remove from source
				sourceItems.splice(activeIndex, 1);

				// 2. Add to destination
				const newDestinationIndex =
					overIndex >= 0 ? overIndex : destinationItems.length;
				destinationItems.splice(newDestinationIndex, 0, activeId);

				newPriorities[sourceTier] = sourceItems;
				newPriorities[destinationTier] = destinationItems;
			}

			return newPriorities;
		});
	};

	const handleSave = async () => {
		setIsSaving(true);
		onPrioritiesChange(localPriorities);
		if (user) {
			try {
				await savePrioritiesToFirebase(user.uid, localPriorities);
				toast.success("Priorities saved to your account.");
			} catch (error) {
				toast.error("Sync failed. Changes saved on this device only.");
			}
		} else {
			toast.success("Priorities saved on this device.");
		}
		setIsSaving(false);
		onOpenChange(false);
	};

	const addMuscleToTier = (muscle: string, tier: PriorityTier) => {
		setLocalPriorities((prev) => ({
			...prev,
			[tier]: [...(prev[tier] || []), muscle],
		}));
	};
	const removeMuscleFromTier = (muscle: string, tier: PriorityTier) => {
		setLocalPriorities((prev) => ({
			...prev,
			[tier]: (prev[tier] || []).filter((m) => m !== muscle),
		}));
	};
	const loadPreset = (presetId: string) => {
		const preset = priorityPresets.find((p) => p.id === presetId);
		if (preset) setLocalPriorities(preset.tiers);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-5xl max-h-[90vh]">
				<DialogHeader>
					<DialogTitle>Muscle Priority Settings</DialogTitle>
					<DialogDescription>
						Drag and drop to rank muscles for personalized recommendations.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col h-[75vh]">
					<div className="flex-shrink-0 space-y-4">
						<div className="flex items-center gap-2">
							<Sparkles className="h-4 w-4 text-primary" />
							<span className="text-sm font-medium">Load Preset:</span>
							<Select onValueChange={loadPreset}>
								<SelectTrigger className="w-[280px]">
									<SelectValue placeholder="Choose a preset..." />
								</SelectTrigger>
								<SelectContent>
									{priorityPresets.map((p) => (
										<SelectItem key={p.id} value={p.id}>
											{p.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						{unassignedMuscles.length > 0 && (
							<Card className="p-4 bg-muted/50">
								<h4 className="font-semibold mb-3">Unassigned Muscles</h4>
								<div className="flex flex-wrap gap-2">
									{unassignedMuscles.map((muscle) => (
										<Select
											key={muscle}
											onValueChange={(tier) =>
												addMuscleToTier(muscle, tier as PriorityTier)
											}
										>
											<SelectTrigger className="w-auto">
												<Badge variant="outline" className="cursor-pointer">
													{muscle}
												</Badge>
											</SelectTrigger>
											<SelectContent>
												{PRIORITY_TIERS.map((tier) => (
													<SelectItem key={tier} value={tier}>
														{TIER_INFO[tier].label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									))}
								</div>
							</Card>
						)}
					</div>

					<ScrollArea className="flex-grow pr-4 -mr-4 mt-4">
						<DndContext
							sensors={sensors}
							collisionDetection={closestCenter}
							onDragEnd={handleDragEnd}
						>
							<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
								{PRIORITY_TIERS.map((tier) => (
									<Card
										key={tier}
										className="p-3"
										style={{ borderTop: `3px solid ${TIER_INFO[tier].color}` }}
									>
										<div className="flex items-center gap-2 mb-3">
											<div
												className="w-3 h-3 rounded-full"
												style={{ backgroundColor: TIER_INFO[tier].color }}
											/>
											<div>
												<h4 className="font-semibold text-sm">
													{TIER_INFO[tier].label}
												</h4>
												<p className="text-xs text-muted-foreground">
													{TIER_INFO[tier].description}
												</p>
											</div>
										</div>
										<SortableContext
											id={tier}
											items={localPriorities[tier] || []}
											strategy={verticalListSortingStrategy}
										>
											<div className="space-y-2 min-h-[100px]">
												{(localPriorities[tier] || []).map((muscle) => (
													<SortableMuscle
														key={muscle}
														muscle={muscle}
														onRemove={() => removeMuscleFromTier(muscle, tier)}
													/>
												))}
											</div>
										</SortableContext>
									</Card>
								))}
							</div>
						</DndContext>
					</ScrollArea>

					<div className="flex-shrink-0 justify-end flex gap-2 pt-4 border-t mt-4">
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button onClick={handleSave} disabled={isSaving}>
							{isSaving ? "Saving..." : "Save Priorities"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
