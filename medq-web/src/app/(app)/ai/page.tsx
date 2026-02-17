"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCourseStore } from "@/lib/stores/course-store";
import { useChatThreads } from "@/lib/hooks/useChatThreads";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  MessageSquare,
  Plus,
  Loader2,
  Compass,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { toast } from "sonner";

export default function AiPage() {
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
      router.push(`/ai/${ref.id}`);
    } catch {
      toast.error("Failed to create conversation. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page-wrap page-stack">
      <div className="glass-card p-5 sm:p-6">
        <h1 className="page-title">AI</h1>
        <p className="page-subtitle">
          Explore any medical topic or chat with AI about your course material.
        </p>
      </div>

      {/* Explore Topic Quick Entry */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Explore Any Topic</CardTitle>
          </div>
          <CardDescription>
            Learn or quiz yourself on any medical topic with AI-generated content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push("/ai/explore")} size="sm">
              <ArrowRight className="mr-2 h-4 w-4" />
              Quick Quiz
            </Button>
            <Button onClick={() => router.push("/ai/explore")} variant="outline" size="sm">
              <BookOpen className="mr-2 h-4 w-4" />
              Guided Learn
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chat Threads */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Chat Threads
          </h2>
          <Button
            onClick={handleNewThread}
            disabled={creating || !courseId}
            size="sm"
            variant="outline"
          >
            {creating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            New Chat
          </Button>
        </div>

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))
        ) : threads.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No conversations yet"
            description="Start a new chat about your study material."
            action={{ label: "New Chat", onClick: handleNewThread }}
          />
        ) : (
          threads.map((thread) => (
            <Card
              key={thread.id}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => router.push(`/ai/${thread.id}`)}
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
