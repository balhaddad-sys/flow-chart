"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/lib/firebase/auth";
import { useAuth } from "@/lib/hooks/useAuth";
import { useThemeStore } from "@/lib/stores/theme-store";
import { Button } from "@/components/ui/button";
import { LoadingButtonLabel } from "@/components/ui/loading-state";
import { cn } from "@/lib/utils";
import {
  Sun,
  Moon,
  Monitor,
  LogOut,
  Trash2,
  GraduationCap,
  ShieldCheck,
  FileText,
  RefreshCw,
  Users,
  ChevronRight,
} from "lucide-react";
import * as fn from "@/lib/firebase/functions";
import { toast } from "sonner";

const themeOptions = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
];

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { mode, setMode } = useThemeStore();
  const [deleting, setDeleting] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out.");
    router.replace("/login");
  }

  async function handleReprocessBlueprints() {
    setReprocessing(true);
    try {
      const result = await fn.reprocessBlueprints({});
      toast.success(result.message || `Updated ${result.updated} section titles.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reprocess.");
    } finally {
      setReprocessing(false);
    }
  }

  async function handleDeleteAccount() {
    if (!confirm("This will permanently delete all your data. Are you sure?")) return;
    if (!confirm("This action cannot be undone. Type DELETE to confirm.")) return;

    setDeleting(true);
    try {
      await fn.deleteUserData();
      await signOut();
      toast.success("Account deleted.");
      router.replace("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page-wrap page-stack max-w-2xl">
      {/* Avatar header */}
      <div className="glass-card overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
        <div className="h-20 bg-gradient-to-r from-primary/18 via-primary/8 to-transparent" />
        <div className="px-6 pb-6">
          <div className="-mt-8 flex items-end gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-4 border-card bg-primary/15 text-xl font-bold text-primary shadow-sm">
              {getInitials(user?.displayName)}
            </div>
            <div className="pb-1 min-w-0">
              <h1 className="text-lg font-bold tracking-tight truncate">{user?.displayName ?? "Student"}</h1>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="glass-card rounded-2xl p-5 animate-in-up stagger-1">
        <h2 className="text-[0.8125rem] font-semibold tracking-tight">Appearance</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Customize how MedQ looks</p>
        <div className="mt-4 flex gap-2">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={cn(
                "flex flex-1 flex-col items-center gap-2 rounded-xl border p-3 transition-all",
                mode === opt.value
                  ? "border-primary/40 bg-primary/8 text-primary"
                  : "border-border/60 text-muted-foreground hover:border-primary/25 hover:text-foreground"
              )}
            >
              <opt.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Courses */}
      <div className="glass-card rounded-2xl p-5 animate-in-up stagger-2">
        <h2 className="text-[0.8125rem] font-semibold tracking-tight">Courses</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Manage your courses and create new ones</p>
        <div className="mt-4 space-y-3">
          <Link href="/onboarding?new=1">
            <Button variant="outline" className="rounded-xl">
              <GraduationCap className="mr-2 h-4 w-4" />
              Manage Courses
            </Button>
          </Link>
          <div>
            <Button variant="outline" className="rounded-xl" onClick={handleReprocessBlueprints} disabled={reprocessing}>
              {reprocessing ? (
                <LoadingButtonLabel label="Refreshing..." />
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Section Titles
                </>
              )}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              Re-analyzes sections with generic titles like &quot;Pages 1-10&quot;
            </p>
          </div>
        </div>
      </div>

      {/* Study Groups */}
      <Link href="/profile/groups">
        <div className="glass-card flex items-center gap-3 rounded-2xl p-4 transition-all hover:border-primary/25 cursor-pointer animate-in-up stagger-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Study Groups</p>
            <p className="text-xs text-muted-foreground">Collaborate with classmates</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </Link>

      {/* Account actions */}
      <div className="glass-card rounded-2xl p-5 animate-in-up stagger-4">
        <h2 className="text-[0.8125rem] font-semibold tracking-tight">Account</h2>
        <div className="mt-4 space-y-3">
          <Button variant="outline" onClick={handleSignOut} className="rounded-xl">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Legal */}
      <div className="glass-card rounded-2xl p-5 animate-in-up stagger-5">
        <h2 className="text-[0.8125rem] font-semibold tracking-tight">Legal & Safety</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          MedQ is an educational study platform and is not a clinical decision tool.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/terms">
            <Button variant="outline" size="sm" className="rounded-xl">
              <FileText className="mr-2 h-4 w-4" />
              Terms
            </Button>
          </Link>
          <Link href="/privacy">
            <Button variant="outline" size="sm" className="rounded-xl">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Privacy
            </Button>
          </Link>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="glass-card rounded-2xl border-destructive/30 p-5 animate-in-up stagger-6">
        <h2 className="text-[0.8125rem] font-semibold tracking-tight text-destructive">Danger Zone</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Permanently delete your account and all associated data.
        </p>
        <div className="mt-4">
          <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting} className="rounded-xl">
            {deleting ? (
              <LoadingButtonLabel label="Deleting..." />
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
