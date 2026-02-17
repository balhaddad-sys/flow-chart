"use client";

import { useState } from "react";
import Link from "next/link";
import { resetPassword } from "@/lib/firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButtonLabel } from "@/components/ui/loading-state";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "auth/user-not-found"
      ) {
        setSent(true);
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to send reset email"
        );
      }
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="space-y-6 text-center">
          <div className="animate-in-scale stagger-1 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/12 border border-green-500/20">
            <CheckCircle2 className="h-7 w-7 text-green-500" />
          </div>
          <div className="space-y-2 animate-in-up stagger-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Check your email
            </h1>
            <p className="text-sm text-muted-foreground">
              If an account exists for <strong className="text-foreground">{email}</strong>, we sent a
              password reset link. Check your inbox and spam folder.
            </p>
          </div>
          <div className="space-y-3 animate-in-up stagger-3">
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl gap-2"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
            >
              <Mail className="h-4 w-4" />
              Try a different email
            </Button>
            <Link href="/login" className="block">
              <Button variant="ghost" className="w-full h-11 rounded-xl gap-2 text-muted-foreground">
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Button>
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2 text-center lg:text-left">
          <h1 className="text-2xl font-semibold tracking-tight animate-in-up stagger-1">
            Reset your password
          </h1>
          <p className="text-sm text-muted-foreground animate-in-up stagger-2">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="animate-in-up rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2 animate-in-up stagger-3">
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-11 rounded-xl"
              required
              autoFocus
            />
          </div>

          <div className="animate-in-up stagger-4">
            <Button
              type="submit"
              className="w-full h-11 rounded-xl text-sm font-medium"
              disabled={loading}
            >
              {loading ? <LoadingButtonLabel label="Sending..." /> : "Send Reset Link"}
            </Button>
          </div>
        </form>

        {/* Footer */}
        <div className="animate-in-up stagger-5">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
