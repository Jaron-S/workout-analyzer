"use client";

// 1. Import your existing Firebase functions
import { useAuth } from "@/lib/auth-context";
import {
	getPrioritiesFromFirebase,
	savePrioritiesToFirebase,
} from "@/lib/firebase-storage";
import { useEffect, useState } from "react";

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
import priorityPresets from "@/data/priority-presets.json";
import { useToast } from "@/hooks/use-toast";
import { ALL_MUSCLES, PRIORITY_TIERS } from "@/lib/constants";
import type { PriorityTier } from "@/lib/types";
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
import { GripVertical, Sparkles } from "lucide-react";

// --- Unchanged parts from your original file ---
// (Props, TIER_INFO, SortableMuscle component)
// --- ... ---

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
				×
			</Button>
		</div>
	);
}
// --- End of unchanged parts ---

export function PrioritySettings({
	open,
	onOpenChange,
	priorities,
	onPrioritiesChange,
}: PrioritySettingsProps) {
	const { toast } = useToast();
	const { user } = useAuth(); // NOTE: Still using the mock useAuth hook
	const [localPriorities, setLocalPriorities] = useState(priorities);
	const [isSaving, setIsSaving] = useState(false);

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	// 2. Update the useEffect to use getPrioritiesFromFirebase
	useEffect(() => {
		if (open && user) {
			getPrioritiesFromFirebase(user.uid).then((firebasePriorities) => {
				// Your function returns {} if nothing is found, so we check for keys
				if (Object.keys(firebasePriorities).length > 0) {
					setLocalPriorities(firebasePriorities);
				} else {
					setLocalPriorities(priorities); // Fallback to local state
				}
			});
		} else if (open) {
			setLocalPriorities(priorities); // User not logged in
		}
	}, [open, user, priorities]);

	// ... (unchanged helper functions like addMuscleToTier, handleDragEnd, etc.)
	const assignedMuscles = new Set(Object.values(localPriorities).flat());
	const unassignedMuscles = ALL_MUSCLES.filter(
		(muscle) => !assignedMuscles.has(muscle)
	);

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

	const handleDragEnd = (event: DragEndEvent, tier: PriorityTier) => {
		const { active, over } = event;
		if (over && active.id !== over.id) {
			setLocalPriorities((prev) => {
				const tierMuscles = prev[tier] || [];
				const oldIndex = tierMuscles.indexOf(active.id as string);
				const newIndex = tierMuscles.indexOf(over.id as string);
				return {
					...prev,
					[tier]: arrayMove(tierMuscles, oldIndex, newIndex),
				};
			});
		}
	};

	const loadPreset = (presetId: string) => {
		const preset = priorityPresets.find((p) => p.id === presetId);
		if (preset) setLocalPriorities(preset.tiers);
	};

	// 3. Update handleSave to use savePrioritiesToFirebase
	const handleSave = async () => {
		setIsSaving(true);
		onPrioritiesChange(localPriorities); // Still update local state immediately

		if (user) {
			try {
				await savePrioritiesToFirebase(user.uid, localPriorities);
				toast({
					title: "Priorities saved",
					description: "Your settings are synced to your account.",
				});
			} catch (error) {
				toast({
					variant: "destructive",
					title: "Sync failed",
					description: "Changes are saved on this device only.",
				});
			}
		} else {
			toast({
				title: "Priorities saved",
				description: "Your settings have been updated on this device.",
			});
		}

		setIsSaving(false);
		onOpenChange(false);
	};

	const handleCancel = () => {
		setLocalPriorities(priorities);
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-5xl max-h-[90vh]">
				{/* --- JSX is unchanged --- */}
				<DialogHeader>
					<DialogTitle>Muscle Priority Settings</DialogTitle>
					<DialogDescription>
						Organize muscles into priority tiers to get personalized training
						recommendations
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-primary" />
						<span className="text-sm font-medium">Load Preset:</span>
						<Select onValueChange={loadPreset}>
							<SelectTrigger className="w-[280px]">
								<SelectValue placeholder="Choose a preset..." />
							</SelectTrigger>
							<SelectContent>
								{priorityPresets.map((preset) => (
									<SelectItem key={preset.id} value={preset.id}>
										{preset.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<ScrollArea className="h-[500px] pr-4">
						<div className="space-y-4">
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

										<DndContext
											sensors={sensors}
											collisionDetection={closestCenter}
											onDragEnd={(event) => handleDragEnd(event, tier)}
										>
											<SortableContext
												items={localPriorities[tier] || []}
												strategy={verticalListSortingStrategy}
											>
												<div className="space-y-2 min-h-[100px]">
													{(localPriorities[tier] || []).map((muscle) => (
														<SortableMuscle
															key={muscle}
															muscle={muscle}
															onRemove={() =>
																removeMuscleFromTier(muscle, tier)
															}
														/>
													))}
												</div>
											</SortableContext>
										</DndContext>
									</Card>
								))}
							</div>
						</div>
					</ScrollArea>

					<div className="flex justify-end gap-2 pt-4 border-t">
						<Button variant="outline" onClick={handleCancel}>
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
