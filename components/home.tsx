"use client";

import { AnalysisPanel } from "@/components/analysis-panel";
import { AuthModal } from "@/components/auth-modal";
import { Wordmark } from "@/components/brand";
import { CoachPanel } from "@/components/coach-panel";
import { CommandMenu } from "@/components/command-menu";
import { HevyPushDialog } from "@/components/hevy-push-dialog";
import { PrioritySettings } from "@/components/priority-settings";
import { ImportDialog } from "@/components/import-dialog";
import { RoutineBuilder } from "@/components/routine-builder";
import { SavedRoutinesModal } from "@/components/saved-routines-modal";
import { SettingsDialog } from "@/components/settings-dialog";
import { ShareDialog } from "@/components/share-dialog";
import { StartPanel } from "@/components/start-panel";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAutoSave, type SaveStatus } from "@/hooks/use-auto-save";
import { useClaudeSync } from "@/hooks/use-claude-sync";
import { useCoach } from "@/hooks/use-coach";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAuth } from "@/lib/auth-context";
import { SETTINGS } from "@/lib/claude-sync";
import { deleteSettingFromFirebase } from "@/lib/firebase-storage";
import { useExercises } from "@/lib/exercise-context";
import { useHevy } from "@/lib/hevy-context";
import { analyzePriorities } from "@/lib/priority-analysis";
import { useSettings } from "@/lib/settings-context";
import { decodeRoutine } from "@/lib/share";
import { loadPriorities, loadRoutine, savePriorities, saveRoutine } from "@/lib/storage";
import { buildSuggestions } from "@/lib/suggestions";
import type { PriorityTier, Routine } from "@/lib/types";
import { cn } from "@/lib/utils";
import { calculateMuscleVolumes } from "@/lib/volume-calculator";
import {
	BarChart3,
	Check,
	CloudOff,
	Command,
	Dumbbell,
	FolderOpen,
	Loader2,
	LogOut,
	Settings,
	Share2,
	SlidersHorizontal,
	Sparkles,
	Upload,
	User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const DEFAULT_ROUTINE: Routine = {
	id: "default",
	name: "My Routine",
	days: [
		{ id: "day-1", name: "Day 1", exercises: [] },
		{ id: "day-2", name: "Day 2", exercises: [] },
		{ id: "day-3", name: "Day 3", exercises: [] },
	],
};

type View = "builder" | "analysis";

/** The app. sharedCode is set when opened from a shared routine link (/r/<code>). */
export function Home({ sharedCode }: { sharedCode?: string }) {
	const { user, signOut, isConfigured } = useAuth();
	const { client: hevyClient } = useHevy();
	const { claudeApiKey } = useSettings();
	const { exercises, getExercise } = useExercises();
	const router = useRouter();

	const [view, setView] = useState<View>("builder");
	const [showAuth, setShowAuth] = useState(false);
	const [showSavedRoutines, setShowSavedRoutines] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [showPriorities, setShowPriorities] = useState(false);
	const [showPush, setShowPush] = useState(false);
	const [showCoach, setShowCoach] = useState(false);
	const [showShare, setShowShare] = useState(false);
	const [showCommands, setShowCommands] = useState(false);
	const [showImport, setShowImport] = useState(false);
	const [shared, setShared] = useState<Routine | null>(null);

	const [routine, setRoutine] = usePersistedState<Routine>("routine", DEFAULT_ROUTINE, saveRoutine, loadRoutine);
	const [priorities, setPriorities] = usePersistedState<Partial<Record<PriorityTier, string[]>>>(
		"priorities",
		{},
		savePriorities,
		loadPriorities
	);

	const coachState = useCoach({ routine, setRoutine, priorities });
	useClaudeSync(user, routine, setRoutine, coachState);
	// A draft from Claude in claude.ai is also removed from the account once
	// it's applied or discarded here, so the chat knows it's been handled.
	const finishConnectorDraft = () => {
		if (user && coachState.draftSource === "connector") {
			deleteSettingFromFirebase(user.uid, SETTINGS.draft).catch((error) => console.error("Failed to clear Claude's draft:", error));
		}
	};
	const coach = {
		...coachState,
		apply: () => {
			finishConnectorDraft();
			coachState.apply();
		},
		discard: () => {
			finishConnectorDraft();
			coachState.discard();
		},
	};
	// While Claude's changes await review, the builder and analysis show the
	// draft, and hand edits go to the draft too.
	const shownRoutine = coach.draft ?? routine;
	const setShownRoutine = coach.draft ? coach.setDraft : setRoutine;
	const save = useAutoSave(user, routine, priorities);

	const suggestions = useMemo(() => {
		const volumes = calculateMuscleVolumes(shownRoutine, exercises);
		return buildSuggestions(analyzePriorities(volumes, priorities), shownRoutine, exercises, getExercise);
	}, [shownRoutine, exercises, getExercise, priorities]);

	// Opened from a shared routine link: offer to import it.
	useEffect(() => {
		if (!sharedCode) return;
		decodeRoutine(sharedCode)
			.then(setShared)
			.catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't open that link."));
	}, [sharedCode]);

	const closeShared = () => {
		setShared(null);
		router.replace("/", { scroll: false });
	};

	/** Replaces the open routine, with undo. Signed-in users keep the old one in My routines. */
	const importRoutine = (imported: Routine) => {
		const previous = routine;
		coach.discard();
		setRoutine(imported);
		toast.success(`Imported "${imported.name}"`, {
			action: { label: "Undo", onClick: () => setRoutine(previous) },
		});
	};

	const importShared = () => {
		if (!shared) return;
		importRoutine(shared);
		closeShared();
	};

	const needsKey = (has: boolean, open: () => void, title: string, description: string) => () => {
		if (has) open();
		else {
			toast(title, { description });
			setShowSettings(true);
		}
	};
	const askClaude = needsKey(
		Boolean(claudeApiKey),
		() => setShowCoach(true),
		"Add an Anthropic API key",
		"Claude uses your own key, which you can add in Settings."
	);
	const pushToHevy = needsKey(
		Boolean(hevyClient),
		() => setShowPush(true),
		"Connect Hevy first",
		"Add your Hevy API key in Settings to push routines."
	);

	const addExercise = (dayId: string, exerciseId: string, sets = 3) => {
		setShownRoutine({
			...shownRoutine,
			days: shownRoutine.days.map((d) => (d.id === dayId ? { ...d, exercises: [...d.exercises, { exerciseId, sets }] } : d)),
		});
		const day = shownRoutine.days.find((d) => d.id === dayId);
		toast.success(`Added ${getExercise(exerciseId)?.name ?? "exercise"} to ${day?.name ?? "the day"}`);
	};

	const handleSignOut = async () => {
		try {
			await signOut();
			toast.success("Signed out");
		} catch {
			toast.error("Couldn't sign out. Try again.");
		}
	};

	const isEmpty = shownRoutine.days.every((d) => d.exercises.length === 0);

	return (
		<div className="flex min-h-dvh flex-col md:h-dvh">
			<header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl">
				<div className="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-3 sm:px-5 md:h-16">
					<Wordmark className="text-lg md:text-xl" />
					<SaveIndicator status={user ? save.status : "idle"} onRetry={save.retry} className="ml-2 hidden md:flex" />
					<div className="ml-auto flex items-center gap-1.5 sm:gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowCommands(true)}
							className="hidden w-44 justify-between text-muted-foreground lg:flex"
						>
							<span>Search…</span>
							<kbd className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 text-[11px]">
								<Command className="h-3 w-3" />K
							</kbd>
						</Button>
						<Button variant="outline" size="sm" onClick={askClaude} className="hidden md:inline-flex">
							<Sparkles className="h-4 w-4 text-brand-text" />
							Ask Claude
						</Button>
						<IconButton label="Share routine" onClick={() => setShowShare(true)} icon={Share2} />
						<Button
							size="sm"
							onClick={pushToHevy}
							disabled={Boolean(coach.draft)}
							title={coach.draft ? "Apply or discard Claude's changes first" : undefined}
							aria-label="Push to Hevy"
							className="max-sm:w-9 max-sm:px-0"
						>
							<Upload className="h-4 w-4" />
							<span className="hidden sm:inline">Push to Hevy</span>
						</Button>
						{(user || isConfigured) && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm" aria-label="Account" className="w-9 px-0">
										<User className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-56">
									{user ? (
										<>
											<DropdownMenuLabel className="space-y-1 font-normal">
												<span className="block truncate text-muted-foreground">{user.email}</span>
												<SaveIndicator status={save.status} onRetry={save.retry} />
											</DropdownMenuLabel>
											<DropdownMenuSeparator />
											<DropdownMenuItem onSelect={() => setShowSavedRoutines(true)}>
												<FolderOpen className="h-4 w-4" />
												My routines
											</DropdownMenuItem>
											<DropdownMenuItem onSelect={() => setShowPriorities(true)}>
												<SlidersHorizontal className="h-4 w-4" />
												Muscle priorities
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem onSelect={handleSignOut}>
												<LogOut className="h-4 w-4" />
												Sign out
											</DropdownMenuItem>
										</>
									) : (
										<>
											<DropdownMenuItem onSelect={() => setShowPriorities(true)}>
												<SlidersHorizontal className="h-4 w-4" />
												Muscle priorities
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem onSelect={() => setShowAuth(true)}>
												<User className="h-4 w-4" />
												Log in or sign up
											</DropdownMenuItem>
										</>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
						)}
						<IconButton label="Settings" onClick={() => setShowSettings(true)} icon={Settings} />
					</div>
				</div>
				{coach.draft && (
					<div className="border-t border-primary/30 bg-primary/10">
						<div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm sm:px-5">
							<span className="flex items-center gap-2">
								<Sparkles className="h-4 w-4 text-brand-text" />
								Previewing {coach.pendingChanges.length} change{coach.pendingChanges.length === 1 ? "" : "s"} from Claude
							</span>
							<div className="flex gap-2">
								<Button size="sm" variant="ghost" onClick={coach.discard}>
									Discard
								</Button>
								<Button size="sm" onClick={coach.apply}>
									<Check className="h-4 w-4" />
									Apply
								</Button>
							</div>
						</div>
					</div>
				)}
			</header>

			<main className="mx-auto grid w-full max-w-[1600px] flex-1 md:min-h-0 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
				<section
					className={cn(
						"@container space-y-4 p-3 pb-28 sm:p-5 md:overflow-y-auto md:pb-8 lg:p-8",
						view !== "builder" && "max-md:hidden"
					)}
				>
					{isEmpty && !coach.draft && (
						<StartPanel onUseTemplate={setRoutine} onAskClaude={askClaude} onImport={() => setShowImport(true)} />
					)}
					<RoutineBuilder
						routine={shownRoutine}
						onRoutineChange={setShownRoutine}
						baseRoutine={coach.draft ? routine : undefined}
						suggestions={suggestions}
						onImport={() => setShowImport(true)}
					/>
				</section>
				<section
					className={cn(
						"@container bg-surface p-3 pb-28 sm:p-5 md:overflow-y-auto md:border-l md:pb-8 lg:p-8",
						view !== "analysis" && "max-md:hidden"
					)}
				>
					<AnalysisPanel
						routine={shownRoutine}
						priorities={priorities}
						onEditPriorities={() => setShowPriorities(true)}
						onAddExercise={addExercise}
					/>
				</section>
			</main>

			<nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
				<div className="grid h-16 grid-cols-3">
					<NavItem label="Builder" icon={Dumbbell} active={view === "builder"} onClick={() => setView("builder")} />
					<NavItem label="Analysis" icon={BarChart3} active={view === "analysis"} onClick={() => setView("analysis")} />
					<NavItem label="Claude" icon={Sparkles} active={showCoach} onClick={askClaude} badge={Boolean(coach.draft)} />
				</div>
			</nav>

			<AuthModal open={showAuth} onOpenChange={setShowAuth} />
			<SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
			<PrioritySettings
				open={showPriorities}
				onOpenChange={setShowPriorities}
				priorities={priorities}
				onPrioritiesChange={setPriorities}
			/>
			<CoachPanel coach={coach} open={showCoach} onOpenChange={setShowCoach} />
			<ShareDialog open={showShare} onOpenChange={setShowShare} routine={routine} />
			<ImportDialog
				open={showImport}
				onOpenChange={setShowImport}
				onImport={importRoutine}
				onConnectHevy={() => setShowSettings(true)}
			/>
			<HevyPushDialog open={showPush} onOpenChange={setShowPush} routine={routine} setRoutine={setRoutine} />
			<SavedRoutinesModal
				open={showSavedRoutines}
				onOpenChange={setShowSavedRoutines}
				onLoadRoutine={setRoutine}
				onLoadPriorities={setPriorities}
			/>
			<CommandMenu
				open={showCommands}
				onOpenChange={setShowCommands}
				routine={shownRoutine}
				actions={{
					askClaude,
					pushToHevy,
					share: () => setShowShare(true),
					importRoutine: () => setShowImport(true),
					openSettings: () => setShowSettings(true),
					editPriorities: () => setShowPriorities(true),
					showView: setView,
					addExercise: (dayId, exerciseId) => addExercise(dayId, exerciseId),
				}}
			/>
			<AlertDialog open={shared !== null} onOpenChange={(open) => !open && closeShared()}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Import &ldquo;{shared?.name}&rdquo;?</AlertDialogTitle>
						<AlertDialogDescription>
							Someone shared a routine with you: {shared?.days.length} days,{" "}
							{shared?.days.reduce((n, d) => n + d.exercises.reduce((m, e) => m + e.sets, 0), 0)} sets a week. Importing
							replaces the routine you have open; you can undo it straight after.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Not now</AlertDialogCancel>
						<AlertDialogAction onClick={importShared}>Import routine</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function IconButton({ label, onClick, icon: Icon }: { label: string; onClick: () => void; icon: typeof Settings }) {
	return (
		<Button variant="outline" size="sm" onClick={onClick} aria-label={label} title={label} className="w-9 px-0">
			<Icon className="h-4 w-4" />
		</Button>
	);
}

function NavItem({
	label,
	icon: Icon,
	active,
	onClick,
	badge,
}: {
	label: string;
	icon: typeof Settings;
	active: boolean;
	onClick: () => void;
	badge?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
				active ? "text-foreground" : "text-muted-foreground"
			)}
			aria-current={active ? "page" : undefined}
		>
			<span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-primary/15 text-brand-text")}>
				<Icon className="h-5 w-5" />
			</span>
			{label}
			{badge && <span className="absolute right-[calc(50%-1.25rem)] top-2.5 h-2 w-2 rounded-full bg-primary" />}
		</button>
	);
}

function SaveIndicator({ status, onRetry, className }: { status: SaveStatus; onRetry: () => void; className?: string }) {
	if (status === "idle") return null;
	return (
		<span className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
			{status === "saving" && (
				<>
					<Loader2 className="h-3 w-3 animate-spin" /> Saving
				</>
			)}
			{status === "saved" && (
				<>
					<Check className="h-3 w-3 text-status-optimal" /> Saved
				</>
			)}
			{status === "error" && (
				<button type="button" onClick={onRetry} className="flex items-center gap-1.5 text-status-under">
					<CloudOff className="h-3 w-3" /> Not saved · retry
				</button>
			)}
		</span>
	);
}
