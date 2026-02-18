"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle,
  X,
  Send,
  Trash2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineLoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/lib/hooks/useAuth";
import { db } from "@/lib/firebase/client";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import * as fn from "@/lib/firebase/functions";
import { toast } from "sonner";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface StudyAskAiWidgetProps {
  sectionTitle: string | undefined;
  courseId: string | undefined;
}

export function StudyAskAiWidget({
  sectionTitle,
  courseId,
}: StudyAskAiWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { user, uid } = useAuth();

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, isOpen]);

  // Auto-focus input on open
  useEffect(() => {
    if (!isOpen) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  // Reset thread when section changes
  useEffect(() => {
    setMessages([]);
    setThreadId(null);
    setInput("");
  }, [courseId, sectionTitle]);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;
    if (!uid) {
      toast.error("Please sign in to use AI chat.");
      return;
    }
    if (!courseId) {
      toast.error("Course context not available yet. Please wait a moment and try again.");
      return;
    }

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      let currentThreadId = threadId;
      if (!currentThreadId) {
        const ref = await addDoc(
          collection(db, "users", uid, "chatThreads"),
          {
            courseId,
            title: `Study: ${sectionTitle || "Section"}`,
            messageCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
        );
        currentThreadId = ref.id;
        setThreadId(currentThreadId);
      }

      const result = await fn.sendChatMessage({
        threadId: currentThreadId,
        message: question,
        courseId,
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.response },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to get response.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, something went wrong: ${message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, uid, courseId, threadId, sectionTitle]);

  function handleClearChat() {
    setMessages([]);
    setThreadId(null);
  }

  if (!user) return null;

  // Floating action button (closed state)
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-primary/35 bg-gradient-to-br from-primary to-sky-500 text-primary-foreground shadow-[0_16px_30px_-18px_rgba(37,99,235,0.95)] transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
        aria-label="Ask AI about this section"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    );
  }

  // Expanded chat panel
  return (
    <div className="fixed bottom-20 right-4 z-40 flex h-[520px] w-[min(92vw,430px)] max-h-[72vh] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.9)] backdrop-blur-xl md:bottom-6 md:right-6">
      {/* Header */}
      <div className="border-b border-border/60 bg-gradient-to-r from-primary/14 via-primary/6 to-transparent px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              AI Tutor
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {sectionTitle || "Ask anything about this section"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleClearChat}
              title="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 rounded-2xl border border-primary/25 bg-primary/10 p-2.5">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Ask anything about{" "}
              <span className="font-medium text-foreground">
                {sectionTitle || "this section"}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground/75">
              Get explanations, clarifications, or deeper insight from your AI tutor.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[88%] rounded-xl border px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "ml-8 border-primary/30 bg-primary/10"
                  : "mr-5 border-border/60 bg-background/80"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="mr-5 flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-sm text-muted-foreground">
              <InlineLoadingState label="Thinking..." className="text-sm" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/60 p-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask a question..."
            className="flex-1 resize-none rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            rows={1}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || loading}
            className="h-9 w-9 shrink-0"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
