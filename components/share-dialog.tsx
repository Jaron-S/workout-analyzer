"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { encodeRoutine } from "@/lib/share";
import type { Routine } from "@/lib/types";
import { Check, Copy, Download, Loader2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ShareDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	routine: Routine;
}

export function ShareDialog({ open, onOpenChange, routine }: ShareDialogProps) {
	const [share, setShare] = useState<{ code: string; skipped: number } | null>(null);
	const [copied, setCopied] = useState(false);
	const [imageLoaded, setImageLoaded] = useState(false);

	useEffect(() => {
		if (!open) return;
		setShare(null);
		setCopied(false);
		setImageLoaded(false);
		encodeRoutine(routine).then(setShare);
	}, [open, routine]);

	const url = share ? `${window.location.origin}/r/${share.code}` : "";
	const imageUrl = share ? `/api/routine-image?r=${share.code}` : "";
	const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

	const copy = async () => {
		await navigator.clipboard.writeText(url);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const nativeShare = () =>
		navigator.share({ title: `${routine.name} · Setsmith`, url }).catch(() => {
			// Cancelling the share sheet rejects; nothing to do.
		});

	const download = async () => {
		try {
			const blob = await (await fetch(imageUrl)).blob();
			const a = document.createElement("a");
			a.href = URL.createObjectURL(blob);
			a.download = `${routine.name.replace(/[^\w-]+/g, "-").toLowerCase() || "routine"}-setsmith.png`;
			a.click();
			URL.revokeObjectURL(a.href);
		} catch {
			toast.error("Couldn't create the image. Try again.");
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader className="text-left">
					<DialogTitle>Share routine</DialogTitle>
					<DialogDescription>
						Anyone with the link can view &ldquo;{routine.name}&rdquo; and copy it into their own Setsmith.
					</DialogDescription>
				</DialogHeader>

				<div className="relative aspect-[1200/630] w-full overflow-hidden rounded-xl border bg-muted">
					{share && (
						<img
							src={imageUrl}
							alt={`${routine.name} share card`}
							className={`h-full w-full object-cover transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
							onLoad={() => setImageLoaded(true)}
						/>
					)}
					{!imageLoaded && <Loader2 className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
				</div>

				{share && share.skipped > 0 && (
					<p className="text-xs text-muted-foreground">
						{share.skipped} custom exercise{share.skipped > 1 ? "s are" : " is"} left out: they only exist in your Hevy account.
					</p>
				)}

				<div className="flex gap-2">
					<Input readOnly value={url} onFocus={(e) => e.target.select()} className="text-xs" aria-label="Share link" />
					<Button onClick={copy} disabled={!share} className="shrink-0">
						{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
						{copied ? "Copied" : "Copy"}
					</Button>
				</div>
				<div className="flex flex-wrap gap-2">
					{canNativeShare && (
						<Button variant="outline" onClick={nativeShare} disabled={!share}>
							<Share2 className="h-4 w-4" />
							Share…
						</Button>
					)}
					<Button variant="outline" onClick={download} disabled={!share}>
						<Download className="h-4 w-4" />
						Download image
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
