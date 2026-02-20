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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  async function handleSignOut() {
    await signOut();
    toast.success("Signed out.");
    router.replace("/login");
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    try {
      await fn.deleteUserData();
      localStorage.clear();
      await signOut();
      toast.success("Account deleted.");
      router.replace("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
      setDeleteConfirmText("");
    }
  }

  return (
    <div className="page-wrap page-stack max-w-2xl">

      {/* Profile header */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {getInitials(user?.displayName)}
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight truncate">{user?.displayName ?? "Student"}</h1>
          <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
        </div>
      </div>

      {/* Appearance */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Appearance</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Customize how MedQ looks</p>
        <div className="mt-4 flex gap-2">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={cn(
                "flex flex-1 flex-col items-center gap-2 rounded-lg border p-3 transition-colors",
                mode === opt.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <opt.icon className="h-4 w-4" />
              <span className="text-xs font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Courses */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Courses</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Manage your courses and create new ones</p>
        <div className="mt-3">
          <Link href="/onboarding?new=1">
            <Button variant="outline" size="sm">
              <GraduationCap className="mr-1.5 h-3.5 w-3.5" />
              Manage Courses
            </Button>
          </Link>
        </div>
      </div>

      {/* Study Groups */}
      <Link href="/profile/groups">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent cursor-pointer">
          <Users className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Study Groups</p>
            <p className="text-xs text-muted-foreground">Collaborate with classmates</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </Link>

      {/* Account */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Account</h2>
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Legal */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Legal & Safety</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          MedQ is an educational study platform and is not a clinical decision tool.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/terms">
            <Button variant="outline" size="sm">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Terms
            </Button>
          </Link>
          <Link href="/privacy">
            <Button variant="outline" size="sm">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              Privacy
            </Button>
          </Link>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-card p-5">
        <h2 className="text-sm font-medium text-destructive">Danger Zone</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Permanently delete your account and all associated data.
        </p>
        <div className="mt-3">
          {!deleteConfirmOpen ? (
            <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete Account
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 p-4">
              <p className="text-sm font-medium text-destructive">
                This will permanently delete all your data.
              </p>
              <p className="text-xs text-muted-foreground">
                Type <span className="font-mono font-semibold text-destructive">DELETE</span> to confirm.
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full rounded-lg border border-red-200 dark:border-red-500/20 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-destructive/40"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirmText !== "DELETE"}
                >
                  {deleting ? (
                    <LoadingButtonLabel label="Deleting..." />
                  ) : (
                    "Confirm Delete"
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmText(""); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
