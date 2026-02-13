"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCourseStore } from "@/lib/stores/course-store";
import { useChatThreads } from "@/lib/hooks/useChatThreads";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Plus, Loader2 } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export default function ChatPage() {
  const router = useRouter();
  const { uid } = useAuth();
  const courseId = useCourseStore((s) => s.activeCourseId);
  const { threads, loading } = useChatThreads(courseId);
  const [creating, setCreating] = useState(false);

  async function handleNewThread() {
    if (!uid || !courseId) return;
    setCreating(true);
    try {
      const ref = await addDoc(collection(db, "users", uid, "chatThreads"), {
        courseId,
        title: "New conversation",
        messageCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      router.push(`/chat/${ref.id}`);
    } catch {
      // silently fail
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Study Assistant</h1>
          <p className="mt-1 text-muted-foreground">
            Chat with AI about your course material.
          </p>
        </div>
        <Button onClick={handleNewThread} disabled={creating || !courseId}>
          {creating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          New Chat
        </Button>
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No conversations yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Start a new chat to ask questions about your study material.
            </p>
          </div>
        ) : (
          threads.map((thread) => (
            <Card
              key={thread.id}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => router.push(`/chat/${thread.id}`)}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <MessageSquare className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{thread.title}</p>
                  {thread.lastMessage && (
                    <p className="truncate text-xs text-muted-foreground">
                      {thread.lastMessage}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {thread.messageCount} msgs
                </span>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
