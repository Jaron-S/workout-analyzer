import { cn } from "@/lib/utils";

/**
 * The Setsmith mark: an anvil whose striking face is a loaded barbell.
 * Drawn on a 32-unit grid in currentColor so it follows the text colour.
 */
export function LogoMark({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" className={cn("h-6 w-6", className)}>
			{/* Barbell resting on the anvil: outer plates, inner plates, bar */}
			<rect x="5" y="2.5" width="2.5" height="9.5" rx="1" />
			<rect x="8" y="4.25" width="2" height="6" rx="0.75" />
			<rect x="24" y="4.25" width="2" height="6" rx="0.75" />
			<rect x="26.5" y="2.5" width="2.5" height="9.5" rx="1" />
			<rect x="9.5" y="6.5" width="15" height="1.5" rx="0.5" />
			{/* Anvil: pointed horn on the left, flat heel on the right, waist and foot */}
			<path d="M1.5 13.5H29v3a1 1 0 0 1-1 1h-5l-1.5 3h3a1.5 1.5 0 0 1 1.5 1.5v3.5H9.5V22a1.5 1.5 0 0 1 1.5-1.5h3l-1.5-3H9C5.5 17.5 3 16 1.5 13.5Z" />
		</svg>
	);
}

export function Wordmark({ className }: { className?: string }) {
	return (
		<span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
			<LogoMark className="h-[1.4em] w-[1.4em] text-primary" />
			<span>Setsmith</span>
		</span>
	);
}
