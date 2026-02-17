"use client";

import { useMemo, useState } from "react";
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
  Bot,
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

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return threads;
    return threads.filter((thread) => {
      const title = thread.title?.toLowerCase() ?? "";
      const preview = thread.lastMessage?.toLowerCase() ?? "";
      return title.includes(term) || preview.includes(term);
    });
  }, [threads, search]);

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
      <section className="glass-card overflow-hidden p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-end">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary animate-in-up stagger-1">
              <Bot className="h-3.5 w-3.5" />
              AI Workspace
            </div>
            <h1 className="page-title animate-in-up stagger-2">Clinical reasoning assistant</h1>
            <p className="page-subtitle max-w-2xl animate-in-up stagger-3">
              Explore any topic, keep longitudinal chat threads, and get
              context-aware guidance from your study material.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => router.push("/ai/explore")} size="sm">
                <Compass className="mr-2 h-4 w-4" />
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
                  <Plus className="mr-2 h-4 w-4" />
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
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-border/70 bg-background/75 px-2 py-3">
              <NumberTicker value={threads.length} className="text-lg font-semibold" />
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Threads
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/75 px-2 py-3">
              <NumberTicker value={totalMessages} className="text-lg font-semibold" />
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Messages
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/75 px-2 py-3">
              <p className="text-lg font-semibold">{courseId ? "On" : "Off"}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Course
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/80 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search threads by title or last message..."
            className="h-8 border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>

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
          <div className="space-y-2.5">
            {filteredThreads.map((thread) => (
              <Card
                key={thread.id}
                className="cursor-pointer border-border/70 transition-all hover:-translate-y-0.5 hover:border-primary/35"
                onClick={() => router.push(`/ai/${thread.id}`)}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="rounded-lg border border-border/70 bg-background/75 p-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{thread.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {thread.lastMessage || "No messages yet"}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-0.5">
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

      <section className="grid gap-3 md:grid-cols-2">
        <Card className="border-primary/25 bg-gradient-to-br from-primary/12 via-primary/6 to-transparent">
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
