"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCourseStore } from "@/lib/stores/course-store";
import * as fn from "@/lib/firebase/functions";
import { ChatMessage } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import { Button } from "@/components/ui/button";
import { SectionLoadingState } from "@/components/ui/loading-state";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { ChatMessage as ChatMessageType } from "@/lib/types/chat";

function toMillis(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const timestamp = value as { toMillis?: () => number };
  return typeof timestamp.toMillis === "function" ? timestamp.toMillis() : 0;
}

export default function ChatThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = use(params);
  const router = useRouter();
  const { uid } = useAuth();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const courseId = useCourseStore((s) => s.activeCourseId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "users", uid, "chatMessages"),
      where("threadId", "==", threadId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs
            .map((d) => ({ ...d.data(), id: d.id }) as ChatMessageType)
            .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt))
        );
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        setLoadError(err?.message || "Failed to load conversation. Check your connection.");
      }
    );
    return unsub;
  }, [uid, threadId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(content: string) {
    if (!uid) {
      toast.error("Please sign in to use AI chat.");
      return;
    }
    if (!courseId) {
      toast.error("No active course selected. Please select a course first.");
      return;
    }
    setSending(true);

    try {
      await fn.sendChatMessage({ threadId, message: content, courseId });
    } catch {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page-wrap flex h-full max-w-5xl flex-col gap-4">
      <div className="glass-card flex items-center gap-3 px-4 py-3">
        <Button variant="ghost" size="icon" aria-label="Back to AI chats" onClick={() => router.push("/ai")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">AI Chat</h1>
      </div>

      <div className="glass-card flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <SectionLoadingState
            title="Loading conversation"
            description="Syncing your AI chat thread."
            rows={3}
            className="border-0 bg-transparent p-0 shadow-none"
          />
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">
              Start the conversation by asking a question about your study material.
            </p>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}
        <div ref={scrollRef} />
      </div>

      <ChatInput onSend={handleSend} disabled={sending} />
    </div>
  );
}
