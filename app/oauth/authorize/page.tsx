"use client";

import { AuthModal } from "@/components/auth-modal";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Check, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

// The connector's consent screen. Claude sends the user here when they add
// Setsmith as a connector; once they're signed in and say yes, the server
// issues a code and the browser goes back to Claude.

interface ClientInfo {
	valid: boolean;
	name?: string;
	host?: string;
}

const CAN = [
	"See your routine, its analysis, your priorities and training defaults",
	"Draft changes to your routine, which apply only after you agree in the chat or apply them in Setsmith",
	"Undo a change it applied, when you ask",
];

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-dvh items-center justify-center bg-background p-4">
			<div className="w-full max-w-md">
				<div className="mb-6 flex justify-center">
					<Wordmark className="text-xl" />
				</div>
				<div className="rounded-2xl border bg-card p-6">{children}</div>
			</div>
		</div>
	);
}

function Authorize() {
	const params = useSearchParams();
	const { user, loading, isConfigured } = useAuth();
	const [client, setClient] = useState<ClientInfo | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [signingIn, setSigningIn] = useState(false);

	const clientId = params.get("client_id") ?? "";
	const redirectUri = params.get("redirect_uri") ?? "";
	const state = params.get("state") ?? "";
	const requestOk =
		params.get("response_type") === "code" && !!params.get("code_challenge") && params.get("code_challenge_method") === "S256";

	useEffect(() => {
		const query = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri });
		fetch(`/api/oauth/approve?${query}`)
			.then((r) => r.json())
			.then((info: ClientInfo) => setClient(info))
			.catch(() => setClient({ valid: false }));
	}, [clientId, redirectUri]);

	const back = (extra: Record<string, string>) => {
		const target = new URL(redirectUri);
		for (const [k, v] of Object.entries(extra)) target.searchParams.set(k, v);
		if (state) target.searchParams.set("state", state);
		window.location.href = target.toString();
	};

	const allow = async () => {
		if (!user) return;
		setBusy(true);
		setError("");
		try {
			const res = await fetch("/api/oauth/approve", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					client_id: clientId,
					redirect_uri: redirectUri,
					state,
					code_challenge: params.get("code_challenge"),
					code_challenge_method: params.get("code_challenge_method"),
					uid: user.uid,
					// The connector acts as the user with this, under the same Firestore rules as the app.
					refresh_token: user.refreshToken,
				}),
			});
			const body = (await res.json()) as { redirect?: string; error?: string };
			if (!res.ok || !body.redirect) throw new Error(body.error ?? "Something went wrong. Try again from Claude.");
			window.location.href = body.redirect;
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setBusy(false);
		}
	};

	if (loading || !client) {
		return (
			<Shell>
				<div className="flex justify-center py-8 text-muted-foreground">
					<Loader2 className="h-5 w-5 animate-spin" />
				</div>
			</Shell>
		);
	}

	if (!client.valid || !requestOk || !isConfigured) {
		return (
			<Shell>
				<h1 className="text-lg font-semibold">This link doesn&rsquo;t work</h1>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					The connection request is incomplete or has been changed. Go back to Claude and add the Setsmith connector again.
				</p>
			</Shell>
		);
	}

	if (!user) {
		return (
			<Shell>
				<h1 className="text-lg font-semibold">Sign in to connect {client.name}</h1>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					{client.name} wants to connect to your Setsmith account. Sign in (or create an account) first; your routines
					save to it automatically.
				</p>
				<Button size="lg" className="mt-5 h-11 w-full" onClick={() => setSigningIn(true)}>
					Sign in
				</Button>
				<AuthModal open={signingIn} onOpenChange={setSigningIn} />
			</Shell>
		);
	}

	return (
		<Shell>
			<h1 className="text-lg font-semibold">Connect {client.name} to Setsmith?</h1>
			<p className="mt-1 text-sm text-muted-foreground">
				Signed in as <span className="text-foreground">{user.email}</span>
			</p>
			<p className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">It will be able to</p>
			<ul className="mt-2.5 space-y-2.5">
				{CAN.map((line) => (
					<li key={line} className="flex gap-2.5 text-sm leading-relaxed">
						<Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" />
						{line}
					</li>
				))}
			</ul>
			<p className="mt-5 text-xs leading-relaxed text-muted-foreground">
				You&rsquo;ll go back to <span className="text-foreground">{client.host}</span>. To disconnect later, remove the connector
				in Claude, or change your Setsmith password to sign out everywhere.
			</p>
			{error && <p className="mt-4 rounded-xl bg-status-under/10 p-3 text-sm text-status-under">{error}</p>}
			<div className="mt-6 flex gap-2">
				<Button variant="ghost" size="lg" className="h-11 flex-1" disabled={busy} onClick={() => back({ error: "access_denied" })}>
					Cancel
				</Button>
				<Button size="lg" className="h-11 flex-1" disabled={busy} onClick={allow}>
					{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Allow"}
				</Button>
			</div>
		</Shell>
	);
}

export default function AuthorizePage() {
	return (
		<Suspense fallback={null}>
			<Authorize />
		</Suspense>
	);
}
