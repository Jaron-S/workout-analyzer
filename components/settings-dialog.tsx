"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { COACH_MODEL, createCoachClient } from "@/lib/coach/agent";
import { useAuth } from "@/lib/auth-context";
import { useExercises } from "@/lib/exercise-context";
import { useHevy } from "@/lib/hevy-context";
import { useSettings } from "@/lib/settings-context";
import {
	formatReps,
	formatRest,
	inferDefaultsFromRoutines,
} from "@/lib/training-defaults";
import type { RepRange, TrainingDefaults } from "@/lib/types";
import { Loader2, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";

interface SettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Settings</DialogTitle>
					<DialogDescription>
						Connect Hevy and Claude, and set the defaults used when an exercise has
						no reps or rest of its own.
					</DialogDescription>
				</DialogHeader>
				<AppearanceSection />
				<Separator />
				<HevySection />
				<Separator />
				<ConnectorSection />
				<Separator />
				<ClaudeSection />
				<Separator />
				<DefaultsSection />
			</DialogContent>
		</Dialog>
	);
}

function HevySection() {
	const { account, error, connect, disconnect, client, refreshExercises, customTemplates } =
		useHevy();
	const { getExercise } = useExercises();
	const { defaults, setDefaults } = useSettings();
	const [keyInput, setKeyInput] = useState("");
	const [busy, setBusy] = useState<null | "connect" | "refresh" | "infer">(null);
	const [suggestion, setSuggestion] = useState<TrainingDefaults | null>(null);

	const run = async (kind: "connect" | "refresh" | "infer", task: () => Promise<void>) => {
		setBusy(kind);
		try {
			await task();
		} catch (e) {
			toast.error("Hevy request failed", {
				description: e instanceof Error ? e.message : String(e),
			});
		} finally {
			setBusy(null);
		}
	};

	const handleConnect = () =>
		run("connect", async () => {
			const info = await connect(keyInput);
			setKeyInput("");
			toast.success(`Connected to Hevy as ${info.username}`);
		});

	const handleRefresh = () =>
		run("refresh", async () => {
			await refreshExercises();
			toast.success("Hevy exercises refreshed");
		});

	const handleInfer = () =>
		run("infer", async () => {
			const routines = await client!.getRoutines();
			setSuggestion(inferDefaultsFromRoutines(routines, getExercise, defaults));
		});

	if (!client) {
		return (
			<section className="space-y-3">
				<h3 className="font-semibold">Hevy</h3>
				<p className="text-sm text-muted-foreground">
					Paste your API key to push routines to Hevy. Hevy only gives API keys to
					Hevy Pro members; find yours at{" "}
					<a
						href="https://hevy.com/settings?developer"
						target="_blank"
						rel="noreferrer"
						className="underline"
					>
						hevy.com/settings
					</a>
					. The key is stored only in this browser.
				</p>
				<div className="flex gap-2">
					<Input
						type="password"
						placeholder="Hevy API key"
						value={keyInput}
						onChange={(e) => setKeyInput(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && keyInput && handleConnect()}
						autoComplete="off"
					/>
					<Button onClick={handleConnect} disabled={!keyInput || busy !== null}>
						{busy === "connect" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
						Connect
					</Button>
				</div>
			</section>
		);
	}

	return (
		<section className="space-y-3">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold">Hevy</h3>
				<Button variant="ghost" size="sm" onClick={disconnect}>
					Disconnect
				</Button>
			</div>
			<p className="text-sm text-muted-foreground">
				{error
					? `Couldn't reach Hevy: ${error}`
					: account
						? `Connected as ${account.username}. ${customTemplates.length} custom exercises loaded.`
						: "Checking connection…"}
			</p>
			<div className="flex flex-wrap gap-2">
				<Button variant="outline" size="sm" onClick={handleRefresh} disabled={busy !== null}>
					{busy === "refresh" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
					Refresh exercises
				</Button>
				<Button variant="outline" size="sm" onClick={handleInfer} disabled={busy !== null}>
					{busy === "infer" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
					Suggest defaults from my Hevy routines
				</Button>
			</div>
			{suggestion && (
				<div className="rounded-md border border-border p-3 text-sm space-y-2">
					<p>Based on your Hevy routines:</p>
					<ul className="text-muted-foreground">
						<li>
							Compound: {formatReps(suggestion.reps.compound)} reps,{" "}
							{formatRest(suggestion.restSeconds.compound)} rest
						</li>
						<li>
							Isolation: {formatReps(suggestion.reps.isolation)} reps,{" "}
							{formatRest(suggestion.restSeconds.isolation)} rest
						</li>
					</ul>
					<div className="flex gap-2">
						<Button
							size="sm"
							onClick={() => {
								setDefaults(suggestion);
								setSuggestion(null);
							}}
						>
							Use these
						</Button>
						<Button size="sm" variant="ghost" onClick={() => setSuggestion(null)}>
							Dismiss
						</Button>
					</div>
				</div>
			)}
		</section>
	);
}

function AppearanceSection() {
	const { theme, setTheme } = useTheme();
	return (
		<section className="flex items-center justify-between gap-3">
			<h3 className="font-semibold">Appearance</h3>
			<ToggleGroup type="single" variant="outline" size="sm" value={theme ?? "system"} onValueChange={(t) => t && setTheme(t)}>
				<ToggleGroupItem value="system" aria-label="Match system" className="gap-1.5 px-2.5">
					<Monitor className="h-3.5 w-3.5" />
					Auto
				</ToggleGroupItem>
				<ToggleGroupItem value="light" aria-label="Light" className="gap-1.5 px-2.5">
					<Sun className="h-3.5 w-3.5" />
					Light
				</ToggleGroupItem>
				<ToggleGroupItem value="dark" aria-label="Dark" className="gap-1.5 px-2.5">
					<Moon className="h-3.5 w-3.5" />
					Dark
				</ToggleGroupItem>
			</ToggleGroup>
		</section>
	);
}

/** Using Setsmith from claude.ai or the Claude apps, on the user's own Claude plan. */
function ConnectorSection() {
	const { user, isConfigured } = useAuth();
	const [copied, setCopied] = useState(false);
	const url = typeof window === "undefined" ? "" : `${window.location.origin}/api/mcp`;
	if (!isConfigured) return null;
	return (
		<section className="space-y-3">
			<h3 className="font-semibold">Claude connector</h3>
			<p className="text-sm text-muted-foreground">
				Use Setsmith from claude.ai or the Claude apps with your own Claude plan; no API key or extra cost. Claude can
				read your routine and its analysis, draft changes, and apply them when you say so.
			</p>
			{!user && <p className="text-sm text-status-maintain">Sign in first: the connector works with routines saved to your account.</p>}
			<div className="flex gap-2">
				<Input readOnly value={url} onFocus={(e) => e.target.select()} className="text-xs" aria-label="Connector URL" />
				<Button
					variant="outline"
					className="shrink-0"
					onClick={async () => {
						await navigator.clipboard.writeText(url);
						setCopied(true);
						setTimeout(() => setCopied(false), 2000);
					}}
				>
					{copied ? "Copied" : "Copy"}
				</Button>
			</div>
			<ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
				<li>In Claude, open Settings → Connectors and choose Add custom connector.</li>
				<li>Name it Setsmith and paste the URL above.</li>
				<li>Choose Connect, then sign in here and allow access.</li>
			</ol>
		</section>
	);
}

function ClaudeSection() {
	const { claudeApiKey, setClaudeApiKey } = useSettings();
	const [keyInput, setKeyInput] = useState("");
	const [checking, setChecking] = useState(false);

	const handleSave = async () => {
		setChecking(true);
		try {
			// A cheap call that fails fast on a bad key or a model the key can't use.
			await createCoachClient(keyInput.trim()).models.retrieve(COACH_MODEL);
			setClaudeApiKey(keyInput.trim());
			setKeyInput("");
			toast.success("Claude is ready");
		} catch (e) {
			toast.error("Couldn't use that key", {
				description: e instanceof Error ? e.message : String(e),
			});
		} finally {
			setChecking(false);
		}
	};

	return (
		<section className="space-y-3">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold">Claude in Setsmith</h3>
				{claudeApiKey && (
					<Button variant="ghost" size="sm" onClick={() => setClaudeApiKey("")}>
						Remove key
					</Button>
				)}
			</div>
			{claudeApiKey ? (
				<p className="text-sm text-muted-foreground">
					Claude can build and edit your routines. Usage is billed to your Anthropic
					account.
				</p>
			) : (
				<>
					<p className="text-sm text-muted-foreground">
						Or chat with Claude right here using an Anthropic API key (billed per use). Create
						one at{" "}
						<a
							href="https://console.anthropic.com/settings/keys"
							target="_blank"
							rel="noreferrer"
							className="underline"
						>
							console.anthropic.com
						</a>
						; usage is billed to that account. The key is stored only in this browser.
					</p>
					<div className="flex gap-2">
						<Input
							type="password"
							placeholder="Anthropic API key"
							value={keyInput}
							onChange={(e) => setKeyInput(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && keyInput && handleSave()}
							autoComplete="off"
						/>
						<Button onClick={handleSave} disabled={!keyInput || checking}>
							{checking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							Save
						</Button>
					</div>
				</>
			)}
		</section>
	);
}

function DefaultsSection() {
	const { defaults, setDefaults } = useSettings();

	const setReps = (kind: "compound" | "isolation", reps: RepRange) =>
		setDefaults((prev) => ({ ...prev, reps: { ...prev.reps, [kind]: reps } }));
	const setRest = (kind: "compound" | "isolation", seconds: number) =>
		setDefaults((prev) => ({
			...prev,
			restSeconds: { ...prev.restSeconds, [kind]: seconds },
		}));

	return (
		<section className="space-y-4">
			<h3 className="font-semibold">Training defaults</h3>

			<div className="flex items-center justify-between">
				<Label>Weight unit</Label>
				<ToggleGroup
					type="single"
					variant="outline"
					value={defaults.weightUnit}
					onValueChange={(unit) =>
						unit && setDefaults((prev) => ({ ...prev, weightUnit: unit as "lb" | "kg" }))
					}
				>
					<ToggleGroupItem value="lb">lb</ToggleGroupItem>
					<ToggleGroupItem value="kg">kg</ToggleGroupItem>
				</ToggleGroup>
			</div>

			{(["compound", "isolation"] as const).map((kind) => (
				<div key={kind} className="space-y-2">
					<Label className="capitalize">{kind} exercises</Label>
					<div className="flex items-center gap-2 text-sm">
						<RepRangeInput value={defaults.reps[kind]} onChange={(r) => setReps(kind, r)} />
						<span className="text-muted-foreground">reps,</span>
						<NumberInput
							value={defaults.restSeconds[kind]}
							onChange={(s) => setRest(kind, s)}
							min={0}
							max={900}
							step={15}
						/>
						<span className="text-muted-foreground">sec rest</span>
					</div>
				</div>
			))}

			<div className="space-y-2">
				<Label>Timed exercises (planks, holds)</Label>
				<div className="flex items-center gap-2 text-sm">
					<NumberInput
						value={defaults.durationSeconds}
						onChange={(s) => setDefaults((prev) => ({ ...prev, durationSeconds: s }))}
						min={5}
						max={3600}
						step={5}
					/>
					<span className="text-muted-foreground">seconds per set</span>
				</div>
			</div>
		</section>
	);
}

export function NumberInput({
	value,
	onChange,
	min,
	max,
	step = 1,
}: {
	value: number;
	onChange: (value: number) => void;
	min: number;
	max: number;
	step?: number;
}) {
	return (
		<Input
			type="number"
			inputMode="numeric"
			className="w-20 h-8"
			value={value}
			min={min}
			max={max}
			step={step}
			onChange={(e) => {
				const n = Number(e.target.value);
				if (e.target.value !== "" && Number.isFinite(n)) {
					onChange(Math.min(max, Math.max(min, Math.round(n))));
				}
			}}
		/>
	);
}

export function RepRangeInput({
	value,
	onChange,
}: {
	value: RepRange;
	onChange: (value: RepRange) => void;
}) {
	return (
		<span className="flex items-center gap-1">
			<NumberInput
				value={value.min}
				min={1}
				max={100}
				onChange={(min) => onChange({ min, max: Math.max(min, value.max) })}
			/>
			<span className="text-muted-foreground">–</span>
			<NumberInput
				value={value.max}
				min={1}
				max={100}
				onChange={(max) => onChange({ min: Math.min(max, value.min), max })}
			/>
		</span>
	);
}
