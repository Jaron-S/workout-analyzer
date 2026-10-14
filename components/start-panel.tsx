"use client";

import { LogoMark } from "@/components/brand";
import { TEMPLATES, routineFromTemplate } from "@/lib/templates";
import type { Routine } from "@/lib/types";
import { ArrowRight, Download, Sparkles } from "lucide-react";

/** Shown while the routine has no exercises: start from a template or ask Claude. */
export function StartPanel({
	onUseTemplate,
	onAskClaude,
	onImport,
}: {
	onUseTemplate: (routine: Routine) => void;
	onAskClaude: () => void;
	onImport: () => void;
}) {
	return (
		<section className="relative overflow-hidden rounded-2xl border bg-card p-4 @md:p-6">
			<LogoMark className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 text-primary/10" />
			<h2 className="text-lg font-semibold tracking-tight @md:text-xl">Forge your training week</h2>
			<p className="mt-1 max-w-md text-sm text-muted-foreground">
				Import the routine you already run, start from a proven split, or have Claude build one around your goals.
			</p>
			<button
				type="button"
				onClick={onImport}
				className="mt-4 flex w-full items-center gap-3 rounded-xl bg-surface p-3 text-left ring-1 ring-border transition hover:ring-primary/60"
			>
				<Download className="h-5 w-5 shrink-0 text-brand-text" />
				<span className="min-w-0">
					<span className="block text-sm font-medium">Import your routine</span>
					<span className="block text-xs text-muted-foreground">From Hevy, or paste it from your notes or a spreadsheet.</span>
				</span>
			</button>
			<div className="mt-2 grid gap-2 @lg:grid-cols-3">
				{TEMPLATES.map((t) => {
					const sets = t.days.reduce((n, [, exs]) => n + exs.reduce((m, [, s]) => m + s, 0), 0);
					return (
						<button
							key={t.id}
							type="button"
							onClick={() => onUseTemplate(routineFromTemplate(t))}
							className="group flex flex-col gap-1 rounded-xl bg-surface p-3 text-left ring-1 ring-border transition hover:ring-primary/60"
						>
							<span className="flex items-center justify-between font-medium">
								{t.name}
								<ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-text" />
							</span>
							<span className="tabular text-xs text-brand-text">
								{t.daysPerWeek} days · {sets} sets a week
							</span>
							<span className="text-xs text-muted-foreground">{t.summary}</span>
						</button>
					);
				})}
			</div>
			<button
				type="button"
				onClick={onAskClaude}
				className="mt-2 flex w-full items-center gap-3 rounded-xl bg-primary/10 p-3 text-left ring-1 ring-primary/30 transition hover:bg-primary/15"
			>
				<Sparkles className="h-5 w-5 shrink-0 text-brand-text" />
				<span className="min-w-0">
					<span className="block text-sm font-medium">Build one with Claude</span>
					<span className="block text-xs text-muted-foreground">
						Describe your goals, schedule and equipment; review the result before it&rsquo;s applied.
					</span>
				</span>
			</button>
		</section>
	);
}
