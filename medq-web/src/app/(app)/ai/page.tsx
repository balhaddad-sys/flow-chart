"use client";

import { useMemo, useState } from "react";
import { useDebouncedValue } from "@/lib/hooks/useDebounce";
import { useRouter } from "next/navigation";
import { useCourseStore } from "@/lib/stores/course-store";
import { useChatThreads } from "@/lib/hooks/useChatThreads";
import { useCourses } from "@/lib/hooks/useCourses";
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

  const activeCourse = useCourses().courses.find((c) => c.id === courseId);

  return (
    <div className="page-wrap page-stack">

      {/* Header with context chip */}
      <div className="animate-in-up">
        <h1 className="page-title">AI</h1>
        <p className="page-subtitle">
          Ask questions, explore topics, and review mistakes — grounded in your study materials.
        </p>

        {/* Active course context chip */}
        {activeCourse && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" />
            {activeCourse.title}
          </div>
        )}

        {/* Mode actions */}
        <div className="flex flex-wrap gap-2 mt-4">
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
            {!creating && "Ask a Question"}
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

      {/* AI capabilities — what you can do */}
      <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-4 animate-in-up stagger-1">
        {[
          { icon: Compass, label: "Explore", desc: "Learn any topic in depth", action: () => router.push("/ai/explore") },
          { icon: MessageSquare, label: "Ask", desc: "Ask about your materials", action: handleNewThread },
          { icon: Sparkles, label: "Explain", desc: "Get mistake breakdowns", action: () => router.push("/ai/explore?autostart=learn") },
          { icon: Search, label: "Summarize", desc: "Condense key concepts", action: handleNewThread },
        ].map((mode) => (
          <button
            key={mode.label}
            onClick={mode.action}
            className="surface-interactive p-4 text-left"
          >
            <mode.icon className="h-4 w-4 text-primary mb-2" />
            <p className="text-[13px] font-semibold">{mode.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{mode.desc}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      {threads.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 shadow-sm animate-in-up stagger-2">
          <Search className="h-4 w-4 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conversations..."
            className="h-8 border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
      )}

      {/* Thread list */}
      {loading ? (
        <ListLoadingState rows={4} />
      ) : filteredThreads.length === 0 && !search.trim() ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          description="Start by exploring a topic or asking a question about your course."
          action={{ label: "Explore a Topic", onClick: () => router.push("/ai/explore") }}
        />
      ) : filteredThreads.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No threads match your search"
          description="Try a different search term."
        />
      ) : (
        <div className="space-y-2 animate-in-up stagger-2">
          <h2 className="section-label">Recent Conversations</h2>
          {filteredThreads.map((thread) => (
            <Card
              key={thread.id}
              className="cursor-pointer transition-all hover:bg-accent/40 hover:border-primary/20"
              onClick={() => router.push(`/ai/${thread.id}`)}
            >
              <CardContent className="flex items-start gap-3 p-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{thread.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {thread.lastMessage || "No messages yet"}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60">
                  <Clock3 className="h-2.5 w-2.5" />
                  {thread.messageCount}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
