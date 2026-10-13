"use client";

import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { Coach } from "@/hooks/use-coach";
import { Loader2, RotateCcw, Send, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const SUGGESTIONS = [
	"Build me a 4-day upper/lower split",
	"Check my routine against my priorities and fix what's off",
	"Swap in exercises I can do with only dumbbells",
];

interface CoachPanelProps {
	coach: Coach;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CoachPanel({ coach, open, onOpenChange }: CoachPanelProps) {
	const [input, setInput] = useState("");
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ block: "end" });
	}, [coach.messages, coach.activity, coach.pendingChanges.length]);

	const submit = (text: string) => {
		if (!text.trim() || coach.busy) return;
		coach.send(text.trim());
		setInput("");
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
				<SheetHeader className="border-b border-border p-4">
					<div className="flex items-center justify-between pr-8">
						<SheetTitle>Claude</SheetTitle>
						{coach.messages.length > 0 && (
							<Button variant="ghost" size="sm" onClick={coach.reset} disabled={coach.busy}>
								New chat
							</Button>
						)}
					</div>
					<SheetDescription>
						Ask Claude to build or change your routine. You review its changes before
						they&rsquo;re applied.
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto p-4 space-y-4">
					{coach.messages.length === 0 && (
						<div className="space-y-2">
							{SUGGESTIONS.map((s) => (
								<button
									key={s}
									type="button"
									onClick={() => submit(s)}
									className="w-full text-left text-sm rounded-md border border-border p-3 hover:bg-accent transition-colors"
								>
									{s}
								</button>
							))}
						</div>
					)}

					{coach.messages.map((m, i) =>
						m.role === "user" ? (
							<div key={i} className="flex justify-end">
								<p className="max-w-[85%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap">
									{m.text}
								</p>
							</div>
						) : (
							<div key={i} className="space-y-2 text-sm">
								{m.text && <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>}
								{m.changes && m.changes.length > 0 && (
									<p className="text-xs text-muted-foreground">
										{m.changes.length} change{m.changes.length > 1 ? "s" : ""} to the draft
									</p>
								)}
								{m.error && <p className="text-destructive">{m.error}</p>}
							</div>
						)
					)}

					{coach.busy && (
						<p className="flex items-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" />
							{coach.activity ?? "Writing"}…
						</p>
					)}

					{coach.draft && !coach.busy && (
						<div className="rounded-md border border-primary/50 bg-primary/5 p-3 space-y-2">
							<p className="text-sm font-medium">
								{coach.pendingChanges.length} change
								{coach.pendingChanges.length > 1 ? "s" : ""} waiting for review
							</p>
							<p className="text-xs text-muted-foreground">
								The builder and analysis show the draft until you apply or discard it.
							</p>
							<ul className="text-sm list-disc pl-5 space-y-0.5">
								{coach.pendingChanges.map((c, i) => (
									<li key={i}>{c}</li>
								))}
							</ul>
							<div className="flex gap-2 pt-1">
								<Button size="sm" onClick={coach.apply}>
									Apply
								</Button>
								<Button size="sm" variant="outline" onClick={coach.discard}>
									Discard
								</Button>
							</div>
						</div>
					)}

					{coach.canUndo && !coach.busy && (
						<p className="flex items-center gap-2 text-sm text-muted-foreground">
							Changes applied.
							<Button size="sm" variant="ghost" className="h-7" onClick={coach.undo}>
								<RotateCcw className="h-3 w-3 mr-1" />
								Undo
							</Button>
						</p>
					)}
					<div ref={bottomRef} />
				</div>

				<form
					className="border-t border-border p-3 flex gap-2 items-end"
					onSubmit={(e) => {
						e.preventDefault();
						submit(input);
					}}
				>
					<Textarea
						rows={2}
						placeholder="Ask Claude…"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								submit(input);
							}
						}}
						className="resize-none"
					/>
					{coach.busy ? (
						<Button type="button" size="icon" variant="outline" onClick={coach.stop} aria-label="Stop">
							<Square className="h-4 w-4" />
						</Button>
					) : (
						<Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send">
							<Send className="h-4 w-4" />
						</Button>
					)}
				</form>
			</SheetContent>
		</Sheet>
	);
}
