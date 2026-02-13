"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/firebase/auth";
import { useAuth } from "@/lib/hooks/useAuth";
import { useThemeStore } from "@/lib/stores/theme-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sun, Moon, Monitor, LogOut, Trash2, Loader2 } from "lucide-react";
import * as fn from "@/lib/firebase/functions";

const themeOptions = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { mode, setMode } = useThemeStore();
  const [deleting, setDeleting] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  async function handleDeleteAccount() {
    if (!confirm("This will permanently delete all your data. Are you sure?")) return;
    if (!confirm("This action cannot be undone. Type DELETE to confirm.")) return;

    setDeleting(true);
    try {
      await fn.deleteUserData();
      await signOut();
      router.replace("/login");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Manage your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-muted-foreground">Name</Label>
            <p className="text-sm font-medium">{user?.displayName ?? "—"}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">Email</Label>
            <p className="text-sm font-medium">{user?.email ?? "—"}</p>
          </div>
          <Separator />
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how MedQ looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {themeOptions.map((opt) => (
              <Button
                key={opt.value}
                variant={mode === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => setMode(opt.value)}
              >
                <opt.icon className="mr-2 h-4 w-4" />
                {opt.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting}>
            {deleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
