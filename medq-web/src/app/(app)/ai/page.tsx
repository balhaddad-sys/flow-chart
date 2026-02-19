"use client";

import { useMemo, useState } from "react";
import { useDebouncedValue } from "@/lib/hooks/useDebounce";
import { useRouter } from "next/navigation";
import { useCourseStore } from "@/lib/stores/course-store";
import { useChatThreads } from "@/lib/hooks/useChatThreads";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListLoadingState, LoadingButtonLabel } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  MessageSquare,
  Plus,
  Compass,
  ArrowRight,
  Search,
  Sparkles,
  Clock3,
} from "lucide-react";
import { NumberTicker } from "@/components/ui/animate-in";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { toast } from "sonner";

export default function AiPage() {
  const router = useRouter();
  const { uid } = useAuth();
  const courseId = useCourseStore((state) => state.activeCourseId);
  const { threads, loading } = useChatThreads(courseId);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebouncedValue(search, 200);
  const filteredThreads = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return threads;
    return threads.filter((thread) => {
      const title = thread.title?.toLowerCase() ?? "";
      const preview = thread.lastMessage?.toLowerCase() ?? "";
      return title.includes(term) || preview.includes(term);
    });
  }, [threads, debouncedSearch]);

  const totalMessages = useMemo(
    () => threads.reduce((sum, thread) => sum + (thread.messageCount || 0), 0),
    [threads]
  );

  const latestThread = filteredThreads[0] ?? null;

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
      {/* Header */}
      <section className="glass-card p-5 sm:p-6 animate-in-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <h1 className="page-title">AI Workspace</h1>
            </div>
            <p className="page-subtitle max-w-xl">
              Explore medical topics in depth, maintain conversation threads, and get context-aware guidance from your study materials.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={() => router.push("/ai/explore")} size="sm">
                <Compass className="mr-1.5 h-3.5 w-3.5" />
                Explore Topic
              </Button>
              <Button
                onClick={handleNewThread}
                disabled={creating || !courseId}
                variant="outline"
                size="sm"
              >
                {creating ? (
                  <LoadingButtonLabel label="Creating..." />
                ) : (
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                )}
                {!creating && "New Chat"}
              </Button>
              {latestThread && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/ai/${latestThread.id}`)}
                >
                  Resume latest
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-3 shrink-0">
            <div className="rounded-xl border border-border bg-background px-4 py-3 text-center min-w-[5rem]">
              <NumberTicker value={threads.length} className="text-2xl font-bold tabular-nums tracking-tight" />
              <p className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Threads
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background px-4 py-3 text-center min-w-[5rem]">
              <NumberTicker value={totalMessages} className="text-2xl font-bold tabular-nums tracking-tight" />
              <p className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Messages
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Search bar */}
      <section className="space-y-3 animate-in-up stagger-1">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search threads by title or last message..."
            className="h-8 border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        {/* Thread list */}
        {loading ? (
          <ListLoadingState rows={4} />
        ) : filteredThreads.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={search.trim() ? "No threads match your search" : "No conversations yet"}
            description="Start a new chat to ask AI about your course content."
            action={{ label: "New Chat", onClick: handleNewThread }}
          />
        ) : (
          <div className="space-y-2">
            {filteredThreads.map((thread, i) => (
              <Card
                key={thread.id}
                className="cursor-pointer border-border transition-all hover:border-primary/30 animate-in-up"
                style={{ animationDelay: `${i * 30}ms` }}
                onClick={() => router.push(`/ai/${thread.id}`)}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="rounded-lg border border-border bg-background p-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{thread.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {thread.lastMessage || "No messages yet"}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5">
                      <Clock3 className="h-3 w-3" />
                      {thread.messageCount} msgs
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Feature cards */}
      <section className="grid gap-3 sm:grid-cols-2 animate-in-up stagger-2">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="space-y-2 p-5">
            <p className="text-sm font-semibold">Explore AI Tutor</p>
            <p className="text-xs text-muted-foreground">
              Generate adaptive quizzes, teaching outlines, and follow-up guidance for any medical topic.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() => router.push("/ai/explore")}
            >
              Open Explore
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-5">
            <p className="text-sm font-semibold">Threaded Course Chat</p>
            <p className="text-xs text-muted-foreground">
              Keep persistent conversations tied to your active course and revisit your reasoning trail.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleNewThread}
              disabled={creating || !courseId}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Create Thread
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
