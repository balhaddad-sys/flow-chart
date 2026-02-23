"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/lib/firebase/auth";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCourses } from "@/lib/hooks/useCourses";
import { useCourseStore } from "@/lib/stores/course-store";
import { useThemeStore } from "@/lib/stores/theme-store";
import { updateCourse, deleteCourse } from "@/lib/firebase/firestore";
import { Button } from "@/components/ui/button";
import { LoadingButtonLabel } from "@/components/ui/loading-state";
import { cn } from "@/lib/utils";
import {
  Sun,
  Moon,
  Monitor,
  LogOut,
  Trash2,
  ShieldCheck,
  FileText,
  Users,
  ChevronRight,
  Check,
  Pencil,
  PlusCircle,
  BookOpen,
  X,
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
  const { courses } = useCourses();
  const activeCourseId = useCourseStore((s) => s.activeCourseId);
  const setActiveCourseId = useCourseStore((s) => s.setActiveCourseId);
  const { mode, setMode } = useThemeStore();
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Course management state
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCourseId && editInputRef.current) editInputRef.current.focus();
  }, [editingCourseId]);

  async function handleRename(courseId: string) {
    const trimmed = editTitle.trim();
    if (!trimmed || !user?.uid) return;
    try {
      await updateCourse(user.uid, courseId, { title: trimmed });
      toast.success("Course renamed");
    } catch {
      toast.error("Failed to rename course");
    }
    setEditingCourseId(null);
  }

  async function handleDeleteCourse(courseId: string) {
    if (!user?.uid) return;
    try {
      await deleteCourse(user.uid, courseId);
      if (activeCourseId === courseId) {
        const remaining = courses.filter((c) => c.id !== courseId);
        setActiveCourseId(remaining.length > 0 ? remaining[0].id : null);
      }
      toast.success("Course deleted");
    } catch {
      toast.error("Failed to delete course");
    }
    setDeletingCourseId(null);
  }
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
      <div className="flex items-center gap-4 animate-in-up">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-lg font-bold text-primary">
          {getInitials(user?.displayName)}
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight truncate">{user?.displayName ?? "Student"}</h1>
          <p className="text-[13px] text-muted-foreground truncate">{user?.email}</p>
        </div>
      </div>

      {/* Appearance */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm animate-in-up stagger-1">
        <h2 className="text-[13px] font-bold tracking-tight">Appearance</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Customize how MedQ looks</p>
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
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm animate-in-up stagger-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-bold tracking-tight">Courses</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Tap a course to switch, or create a new one</p>
          </div>
          <Link href="/onboarding?new=1">
            <Button variant="outline" size="sm">
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
              New
            </Button>
          </Link>
        </div>

        {courses.length === 0 ? (
          <p className="mt-4 text-center text-xs text-muted-foreground py-4">
            No courses yet. Create one to get started.
          </p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {courses.map((course) => {
              const isActive = course.id === activeCourseId;
              const isEditing = editingCourseId === course.id;
              const isDeleting = deletingCourseId === course.id;

              return (
                <div key={course.id}>
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2.5 transition-all",
                      isActive
                        ? "bg-primary/10 border border-primary/20"
                        : "border border-transparent hover:bg-muted cursor-pointer"
                    )}
                    onClick={() => {
                      if (!isEditing && !isDeleting) {
                        setActiveCourseId(course.id);
                        if (!isActive) toast.success(`Switched to ${course.title}`);
                      }
                    }}
                  >
                    {/* Active indicator */}
                    <div className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      {isActive && <Check className="h-3 w-3" />}
                    </div>

                    {/* Title or edit input */}
                    {isEditing ? (
                      <form
                        className="flex flex-1 items-center gap-1.5"
                        onSubmit={(e) => { e.preventDefault(); handleRename(course.id); }}
                      >
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
                          onKeyDown={(e) => { if (e.key === "Escape") setEditingCourseId(null); }}
                        />
                        <Button type="submit" variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!editTitle.trim()}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingCourseId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm truncate", isActive && "font-medium")}>{course.title}</p>
                        {course.examType && (
                          <p className="text-[11px] text-muted-foreground">{course.examType}</p>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {!isEditing && !isDeleting && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCourseId(course.id);
                            setEditTitle(course.title);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-destructive dark:hover:bg-red-500/10 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingCourseId(course.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Delete confirmation */}
                  {isDeleting && (
                    <div className="ml-7 mt-1 flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 px-3 py-2">
                      <p className="flex-1 text-xs text-destructive">Delete this course?</p>
                      <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => handleDeleteCourse(course.id)}>
                        Delete
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setDeletingCourseId(null)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Study Groups */}
      <Link href="/profile/groups">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:bg-accent hover:border-primary/20 cursor-pointer animate-in-up stagger-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Study Groups</p>
            <p className="text-xs text-muted-foreground">Collaborate with classmates</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </Link>

      {/* App Guide */}
      <Link href="/guide">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:bg-accent hover:border-primary/20 cursor-pointer animate-in-up stagger-4">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">App Guide</p>
            <p className="text-xs text-muted-foreground">
              Learn the full workflow from setup to exam prep.
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </Link>

      {/* Account */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm animate-in-up stagger-5">
        <h2 className="text-[13px] font-bold tracking-tight">Account</h2>
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Legal */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm animate-in-up stagger-6">
        <h2 className="text-[13px] font-bold tracking-tight">Legal & Safety</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
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
      <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-card p-4 animate-in-up stagger-7">
        <h2 className="text-[13px] font-bold tracking-tight text-destructive">Danger Zone</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
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
