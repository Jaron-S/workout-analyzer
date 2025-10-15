"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { useAuth } from "@/lib/auth-context";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type React from "react";
import { useState } from "react";

interface AuthModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
	const [mode, setMode] = useState<"signin" | "signup" | "forgotPassword">(
		"signin"
	);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");

	const { signIn, signUp, sendPasswordReset } = useAuth();

	const handleModeChange = (
		newMode: "signin" | "signup" | "forgotPassword"
	) => {
		setMode(newMode);
		setError("");
		setMessage("");
		setPassword("");
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setMessage("");
		setLoading(true);

		try {
			if (mode === "forgotPassword") {
				await sendPasswordReset(email);
				setMessage("Password reset link sent! Please check your inbox.");
			} else if (mode === "signin") {
				await signIn(email, password);
				onOpenChange(false);
				setEmail("");
				setPassword("");
			} else {
				await signUp(email, password);
				onOpenChange(false);
				setEmail("");
				setPassword("");
			}
		} catch (err: any) {
			setError(err.message || "An error occurred");
		} finally {
			setLoading(false);
		}
	};

	const getTitle = () => {
		if (mode === "forgotPassword") return "Reset Password";
		return mode === "signin" ? "Sign In" : "Create Account";
	};

	const getDescription = () => {
		if (mode === "forgotPassword")
			return "Enter your email to receive a password reset link.";
		return mode === "signin"
			? "Sign in to sync your routines across devices"
			: "Create an account to get started";
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{getTitle()}</DialogTitle>
					<DialogDescription>{getDescription()}</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@example.com"
							required
						/>
					</div>

					{mode !== "forgotPassword" && (
						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="••••••••"
								required
								minLength={6}
							/>
							{mode === "signin" && (
								<div className="text-right">
									<Button
										type="button"
										variant="link"
										className="h-auto p-0 text-sm font-normal"
										onClick={() => handleModeChange("forgotPassword")}
									>
										Forgot Password?
									</Button>
								</div>
							)}
						</div>
					)}

					{error && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{message && (
						<Alert
							variant="default"
							className="border-green-200 bg-green-50 text-green-800"
						>
							<CheckCircle2 className="h-4 w-4 text-green-500" />
							<AlertDescription>{message}</AlertDescription>
						</Alert>
					)}

					<Button type="submit" className="w-full" disabled={loading}>
						{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{mode === "forgotPassword"
							? "Send Reset Link"
							: mode === "signin"
							? "Sign In"
							: "Create Account"}
					</Button>

					{mode === "forgotPassword" ? (
						<Button
							type="button"
							variant="ghost"
							className="w-full"
							onClick={() => handleModeChange("signin")}
						>
							Back to Sign In
						</Button>
					) : (
						<Button
							type="button"
							variant="ghost"
							className="w-full"
							onClick={() =>
								handleModeChange(mode === "signin" ? "signup" : "signin")
							}
						>
							{mode === "signin"
								? "Need an account? Sign up"
								: "Already have an account? Sign in"}
						</Button>
					)}
				</form>
			</DialogContent>
		</Dialog>
	);
}
