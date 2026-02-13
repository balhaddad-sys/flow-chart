"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Users, Trophy, Check } from "lucide-react";
import type { StudyGroup } from "@/lib/types/group";

export default function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const router = useRouter();
  const { uid } = useAuth();
  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "studyGroups", groupId), (snap) => {
      if (snap.exists()) {
        setGroup({ ...snap.data(), id: snap.id } as StudyGroup);
      }
    });
    return unsub;
  }, [groupId]);

  function handleCopyCode() {
    if (!group) return;
    navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/groups")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{group.name}</h1>
          {group.description && (
            <p className="text-sm text-muted-foreground">{group.description}</p>
          )}
        </div>
        <Badge variant="secondary">
          <Users className="mr-1 h-3 w-3" />
          {group.memberCount}
        </Badge>
      </div>

      {/* Invite code */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite Code</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <code className="rounded bg-muted px-4 py-2 text-lg font-mono font-bold tracking-wider">
            {group.inviteCode}
          </code>
          <Button variant="outline" size="sm" onClick={handleCopyCode}>
            {copied ? (
              <Check className="mr-1 h-4 w-4 text-green-500" />
            ) : (
              <Copy className="mr-1 h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </CardContent>
      </Card>

      {/* Members placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            Members ({group.memberCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {group.members.map((memberId) => (
              <div key={memberId} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {memberId === uid ? "You" : memberId.slice(0, 8) + "..."}
                  </p>
                </div>
                {memberId === group.createdBy && (
                  <Badge variant="outline" className="text-xs">Owner</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Challenges placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Challenges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            Quiz challenges will be available once the backend Cloud Functions are deployed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
