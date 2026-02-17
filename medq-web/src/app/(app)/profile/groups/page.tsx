"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, Plus, LogIn, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { StudyGroup } from "@/lib/types/group";

export default function GroupsPage() {
  const router = useRouter();
  const { uid, user } = useAuth();
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setGroups([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "studyGroups"),
      where("members", "array-contains", uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      setGroups(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as StudyGroup));
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  async function handleCreate() {
    if (!uid || !user || !createName.trim()) return;
    setCreating(true);
    try {
      const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
      const ref = await addDoc(collection(db, "studyGroups"), {
        name: createName.trim(),
        description: createDesc.trim() || null,
        inviteCode,
        createdBy: uid,
        memberCount: 1,
        members: [uid],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCreateName("");
      setCreateDesc("");
      setCreateOpen(false);
      toast.success("Study group created!");
      router.push(`/profile/groups/${ref.id}`);
    } catch {
      toast.error("Failed to create group.");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin() {
    if (!uid || !joinCode.trim()) return;
    setJoining(true);
    setJoinError(null);
    try {
      const q = query(
        collection(db, "studyGroups"),
        where("inviteCode", "==", joinCode.trim().toUpperCase())
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setJoinError("Invalid invite code.");
        return;
      }
      const groupDoc = snap.docs[0];
      const groupData = groupDoc.data() as StudyGroup;
      if (groupData.members.includes(uid)) {
        router.push(`/profile/groups/${groupDoc.id}`);
        return;
      }
      const { updateDoc, arrayUnion, increment } = await import("firebase/firestore");
      await updateDoc(groupDoc.ref, {
        members: arrayUnion(uid),
        memberCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      setJoinCode("");
      setJoinOpen(false);
      toast.success("Joined group!");
      router.push(`/profile/groups/${groupDoc.id}`);
    } catch {
      setJoinError("Failed to join group.");
      toast.error("Failed to join group.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:space-y-6 sm:p-6">
      <Link
        href="/profile"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Profile
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Groups</h1>
          <p className="text-sm text-muted-foreground">
            Collaborate with other students.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <LogIn className="mr-2 h-4 w-4" />
                Join
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join a Study Group</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Invite Code</Label>
                  <Input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="e.g. ABC123"
                    className="uppercase"
                  />
                </div>
                {joinError && (
                  <p className="text-sm text-destructive">{joinError}</p>
                )}
                <Button onClick={handleJoin} disabled={joining || !joinCode.trim()} className="w-full">
                  {joining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Join Group
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Study Group</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Group Name</Label>
                  <Input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Year 3 Study Group"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input
                    value={createDesc}
                    onChange={(e) => setCreateDesc(e.target.value)}
                    placeholder="What's this group about?"
                  />
                </div>
                <Button onClick={handleCreate} disabled={creating || !createName.trim()} className="w-full">
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create Group
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-lg border bg-accent/50 px-4 py-3 text-sm text-muted-foreground">
        Share invite codes with classmates. Group challenges coming soon.
      </div>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))
        ) : groups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No groups yet"
            description="Create a group or join with an invite code."
          />
        ) : (
          groups.map((group) => (
            <Card
              key={group.id}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => router.push(`/profile/groups/${group.id}`)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{group.name}</p>
                  {group.description && (
                    <p className="truncate text-xs text-muted-foreground">{group.description}</p>
                  )}
                </div>
                <Badge variant="secondary">{group.memberCount} members</Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
