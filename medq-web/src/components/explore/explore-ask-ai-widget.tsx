"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExploreStore } from "@/lib/stores/explore-store";
import { useAuth } from "@/lib/hooks/useAuth";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

let msgCounter = 0;
function nextId() {
  return `msg-${++msgCounter}-${Date.now()}`;
}

export function ExploreAskAiWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const { topicInsight, topic } = useExploreStore();

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset messages when topic changes
  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [topic]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || !topicInsight) return;

    setInput("");
    const userMsg: ChatMsg = { id: nextId(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const idToken = await user?.getIdToken();
      const res = await fetch("/api/explore-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          message: trimmed,
          topic,
          level: topicInsight.level ?? topicInsight.levelLabel,
          context: {
            summary: topicInsight.summary,
            corePoints: topicInsight.corePoints?.slice(0, 5),
            sectionTitles: topicInsight.teachingSections?.map(
              (s) => s.title
            ),
          },
          history: messages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to get response");
      }

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: json.data.response },
      ]);
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Failed to get response.";
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: `Sorry, something went wrong: ${errMsg}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, topicInsight, user, topic, messages]);

  if (!topicInsight) return null;

  // ── Collapsed: FAB button ──────────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
        aria-label="Ask AI about this topic"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    );
  }

  // ── Expanded: Chat panel ───────────────────────────────────────────
  return (
    <div className="fixed bottom-20 right-4 z-40 flex h-[480px] w-[340px] max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.55)] backdrop-blur-xl sm:w-[380px] md:bottom-6 md:right-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
          <p className="truncate text-sm font-semibold">
            Ask about {topic}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setIsOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageCircle className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Ask anything about{" "}
              <span className="font-medium text-foreground">{topic}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Follow up on concepts, ask for clarification, or explore clinical
              scenarios.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "ml-8 border border-primary/20 bg-primary/5"
                  : "mr-4 border border-blue-200/60 bg-blue-50/40 dark:border-blue-900/50 dark:bg-blue-950/20"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="mr-4 flex items-center gap-2 rounded-xl border border-blue-200/60 bg-blue-50/40 px-3 py-2 text-sm text-muted-foreground dark:border-blue-900/50 dark:bg-blue-950/20">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/60 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 resize-none rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={loading || !input.trim()}
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
