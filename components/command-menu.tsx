"use client";

import { Thumb } from "@/components/exercise-card";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@/components/ui/command";
import { useExercises } from "@/lib/exercise-context";
import { searchExercises } from "@/lib/search";
import type { Exercise, Routine } from "@/lib/types";
import { BarChart3, CalendarPlus, Dumbbell, Monitor, Moon, Settings, Share2, Sparkles, Sun, Upload } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";

export interface CommandActions {
	askClaude: () => void;
	pushToHevy: () => void;
	share: () => void;
	openSettings: () => void;
	showView: (view: "builder" | "analysis") => void;
	addExercise: (dayId: string, exerciseId: string) => void;
}

/** Cmd/Ctrl+K: find an exercise and add it to a day, or jump to any action. */
export function CommandMenu({
	open,
	onOpenChange,
	routine,
	actions,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	routine: Routine;
	actions: CommandActions;
}) {
	const { exercises } = useExercises();
	const { setTheme } = useTheme();
	const [search, setSearch] = useState("");
	const [picked, setPicked] = useState<Exercise | null>(null);
	const listRef = useRef<HTMLDivElement>(null);

	// New results start at the top, heading included.
	useEffect(() => {
		requestAnimationFrame(() => listRef.current?.scrollTo({ top: 0 }));
	}, [search, picked]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				onOpenChange(!open);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onOpenChange]);

	useEffect(() => {
		if (!open) {
			setSearch("");
			setPicked(null);
		}
	}, [open]);

	// Searching 450+ exercises on every keystroke is fine; showing them all isn't.
	const matches = useMemo(
		() => (search.trim() ? searchExercises(exercises, search).filter((e) => !e.legacy).slice(0, 8) : []),
		[exercises, search]
	);

	const run = (action: () => void) => {
		onOpenChange(false);
		action();
	};

	return (
		<CommandDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Command menu"
			description="Add an exercise or run an action"
			className="sm:max-w-lg"
		>
			{/* Exercises are pre-matched above to keep the list short; cmdk then filters everything shown. */}
			<CommandInput
				placeholder={picked ? `Add ${picked.name} to…` : "Search exercises or actions"}
				value={search}
				onValueChange={setSearch}
			/>
			<CommandList ref={listRef} className="max-h-[min(420px,60vh)]">
				<CommandEmpty>Nothing found.</CommandEmpty>
				{picked ? (
					<CommandGroup heading={`Add ${picked.name} to`}>
						{routine.days.map((day) => (
							<CommandItem key={day.id} value={`day ${day.name}`} onSelect={() => run(() => actions.addExercise(day.id, picked.id))}>
								<CalendarPlus />
								{day.name}
								<CommandShortcut>{day.exercises.length} exercises</CommandShortcut>
							</CommandItem>
						))}
					</CommandGroup>
				) : (
					<>
						{matches.length > 0 && (
							<CommandGroup heading="Add exercise">
								{matches.map((ex) => (
									<CommandItem
										key={ex.id}
										value={`exercise ${ex.name} ${ex.id}`}
										onSelect={() => {
											setPicked(ex);
											setSearch("");
										}}
									>
										<Thumb exercise={ex} className="h-8 w-8 rounded-md" />
										<span className="truncate">{ex.name}</span>
									</CommandItem>
								))}
							</CommandGroup>
						)}
						<CommandGroup heading="Actions">
							<CommandItem onSelect={() => run(actions.askClaude)}>
								<Sparkles />
								Ask Claude
							</CommandItem>
							<CommandItem onSelect={() => run(actions.pushToHevy)}>
								<Upload />
								Push to Hevy
							</CommandItem>
							<CommandItem onSelect={() => run(actions.share)}>
								<Share2 />
								Share routine
							</CommandItem>
							<CommandItem onSelect={() => run(() => actions.showView("builder"))}>
								<Dumbbell />
								Show builder
							</CommandItem>
							<CommandItem onSelect={() => run(() => actions.showView("analysis"))}>
								<BarChart3 />
								Show analysis
							</CommandItem>
							<CommandItem onSelect={() => run(actions.openSettings)}>
								<Settings />
								Settings
							</CommandItem>
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup heading="Theme">
							<CommandItem onSelect={() => run(() => setTheme("light"))}>
								<Sun />
								Light
							</CommandItem>
							<CommandItem onSelect={() => run(() => setTheme("dark"))}>
								<Moon />
								Dark
							</CommandItem>
							<CommandItem onSelect={() => run(() => setTheme("system"))}>
								<Monitor />
								Match system
							</CommandItem>
						</CommandGroup>
					</>
				)}
			</CommandList>
		</CommandDialog>
	);
}
