"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Send,
  Trash2,
  CircleStop,
  Sparkles,
  RotateCcw,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InlineLoadingState } from "@/components/ui/loading-state";
import { useExploreStore } from "@/lib/stores/explore-store";
import { useAuth } from "@/lib/hooks/useAuth";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  cached?: boolean;
  createdAt: number;
}

interface StoredChatMsg {
  role: "user" | "assistant";
  content: string;
  cached?: boolean;
  createdAt: number;
}

const STORAGE_KEY_PREFIX = "medq_explore_chat_v2";
const MAX_PERSISTED_MESSAGES = 40;
const MAX_HISTORY_FOR_REQUEST = 6;

let msgCounter = 0;
function nextId() {
  return `msg-${++msgCounter}-${Date.now()}`;
}

function normalizeStoredMessages(value: unknown): ChatMsg[] {
  if (!Array.isArray(value)) return [];

  const normalized = value
    .map((item) => {
      const msg = item as StoredChatMsg;
      if (
        !msg ||
        (msg.role !== "user" && msg.role !== "assistant") ||
        typeof msg.content !== "string"
      ) {
        return null;
      }
      return {
        id: nextId(),
        role: msg.role,
        content: msg.content.slice(0, 3_000),
        cached: Boolean(msg.cached),
        createdAt:
          typeof msg.createdAt === "number" && Number.isFinite(msg.createdAt)
            ? msg.createdAt
            : Date.now(),
      } as ChatMsg;
    })
    .filter((item): item is ChatMsg => item !== null);

  return normalized.slice(-MAX_PERSISTED_MESSAGES);
}

export function ExploreAskAiWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  // Portal needs the DOM to be mounted (avoid SSR mismatch)
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastRequestRef = useRef<{ message: string; history: ChatMsg[] } | null>(
    null
  );

  const { user } = useAuth();
  const { topicInsight, topic } = useExploreStore();

  const levelKey = (topicInsight?.level || topicInsight?.levelLabel || "general")
    .toString()
    .trim()
    .toLowerCase();
  const storageKey = useMemo(
    () => `${STORAGE_KEY_PREFIX}:${topic.trim().toLowerCase()}:${levelKey}`,
    [topic, levelKey]
  );

  const quickPrompts = useMemo(
    () => [
      `Give me 5 high-yield exam bullets on ${topic}.`,
      `What is the diagnostic framework for ${topic}?`,
      `Explain ${topic} like a viva answer: concise and structured.`,
      `What mistakes do students make most with ${topic}?`,
    ],
    [topic]
  );

  useEffect(() => {
    if (!topicInsight) return;

    setInput("");
    setRequestError(null);

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setMessages([]);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      setMessages(normalizeStoredMessages(parsed));
    } catch {
      setMessages([]);
    }
  }, [topicInsight, storageKey]);

  useEffect(() => {
    if (!topicInsight) return;
    try {
      const toStore = messages.slice(-MAX_PERSISTED_MESSAGES).map((msg) => ({
        role: msg.role,
        content: msg.content,
        cached: msg.cached,
        createdAt: msg.createdAt,
      }));
      window.localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch {
      // Ignore localStorage failures.
    }
  }, [messages, storageKey, topicInsight]);

  useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 200);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  // Lock body scroll when drawer is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const runRequest = useCallback(
    async (message: string, historyBeforeRequest: ChatMsg[], appendUser: boolean) => {
      if (!topicInsight || loading) return;
      if (!user) {
        setRequestError("Not signed in. Please refresh the page.");
        return;
      }

      const trimmed = message.trim();
      if (!trimmed) return;

      setRequestError(null);

      if (appendUser) {
        const userMsg: ChatMsg = {
          id: nextId(),
          role: "user",
          content: trimmed,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, userMsg]);
      }

      lastRequestRef.current = {
        message: trimmed,
        history: historyBeforeRequest,
      };

      setLoading(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const requestBody = JSON.stringify({
          message: trimmed,
          topic,
          level: topicInsight.level ?? topicInsight.levelLabel,
          context: {
            summary: topicInsight.summary,
            corePoints: topicInsight.corePoints?.slice(0, 5),
            sectionTitles: topicInsight.teachingSections?.map((section) => section.title),
          },
          history: historyBeforeRequest.slice(-MAX_HISTORY_FOR_REQUEST).map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        });

        let idToken = await user.getIdToken();
        let res = await fetch("/api/explore-chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          signal: controller.signal,
          body: requestBody,
        });

        if (res.status === 401) {
          idToken = await user.getIdToken(true);
          res = await fetch("/api/explore-chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
            },
            signal: controller.signal,
            body: requestBody,
          });
        }

        const json = (await res.json()) as {
          success?: boolean;
          error?: string;
          data?: { response?: string; cached?: boolean };
        };

        if (!res.ok || !json.success || !json.data?.response) {
          throw new Error(json.error || "Failed to get response");
        }

        const assistantMessage: ChatMsg = {
          id: nextId(),
          role: "assistant",
          content: json.data.response,
          cached: Boolean(json.data.cached),
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Failed to get response.";
        setRequestError(message);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content: `Sorry, I couldn't answer that right now: ${message}`,
            createdAt: Date.now(),
          },
        ]);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setLoading(false);
      }
    },
    [topicInsight, loading, user, topic]
  );

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || !topicInsight) return;
    const history = messages;
    setInput("");
    await runRequest(trimmed, history, true);
  }, [input, loading, topicInsight, messages, runRequest]);

  const handleRetry = useCallback(async () => {
    if (loading || !lastRequestRef.current) return;
    const { message, history } = lastRequestRef.current;
    await runRequest(message, history, false);
  }, [loading, runRequest]);

  function handleStopRequest() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }

  function handleClearChat() {
    if (messages.length > 0 && !window.confirm("Clear chat history for this topic?")) return;
    setMessages([]);
    setRequestError(null);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore localStorage failures.
    }
  }

  if (!topicInsight || !mounted) return null;

  // Render via portal so position:fixed escapes any CSS-transform ancestor
  // (the app-shell animate-in-up wrapper uses transform:translateY(0) which
  // would otherwise make fixed elements position relative to it, not the viewport)
  return createPortal(
    <>
      {/* Pull tab — visible on the right edge whenever the drawer is closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open AI tutor"
          className="fixed right-0 top-1/2 z-40 -translate-y-1/2 flex flex-col items-center gap-1.5 rounded-l-2xl border border-r-0 border-primary/40 bg-card/95 px-2 py-4 shadow-[−4px_0_20px_-4px_rgba(37,99,235,0.35)] backdrop-blur-md transition-all hover:px-3 active:scale-95"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <span
            className="text-[10px] font-bold tracking-widest text-primary"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          >
            AI
          </span>
          <ChevronLeft className="h-3.5 w-3.5 text-primary/70" />
        </button>
      )}

      {/* Full-screen drawer overlay */}
      <div
        className={`fixed inset-0 z-50 transition-all duration-300 ${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div
          onClick={() => setIsOpen(false)}
          className={`absolute inset-0 bg-background/50 backdrop-blur-[2px] transition-opacity duration-300 ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Drawer panel — full width on mobile, capped on desktop */}
        <div
          className={`absolute inset-y-0 right-0 flex w-full flex-col border-l border-border/70 bg-card shadow-2xl transition-transform duration-300 ease-out sm:w-[min(92vw,480px)] ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-border/60 bg-gradient-to-r from-primary/12 via-primary/5 to-transparent px-4 py-3">
            <button
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1.5 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              aria-label="Close AI panel"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Ask AI · {topic}</p>
                <p className="text-[11px] text-muted-foreground">
                  Context-aware tutor
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={handleClearChat}
              aria-label="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Quick prompts */}
          <div className="shrink-0 border-b border-border/60 px-3 py-2.5">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Quick prompts
            </p>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setInput(prompt)}
                  className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && !loading && (
              <div className="flex h-full flex-col items-center justify-center text-center px-4">
                <div className="mb-3 rounded-2xl border border-primary/25 bg-primary/10 p-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium">Ask anything about</p>
                <p className="text-sm font-semibold text-primary">{topic}</p>
                <p className="mt-2 text-xs text-muted-foreground/75 max-w-xs">
                  Use the quick prompts above, or type your own question. Follow up
                  to go deeper.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl border px-4 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "ml-10 border-primary/30 bg-primary/10"
                      : "mr-6 border-border/60 bg-background/80"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words leading-relaxed">
                    {msg.content}
                  </p>
                  {msg.cached && (
                    <Badge variant="outline" className="mt-2 text-[10px]">
                      cached
                    </Badge>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="mr-6 flex items-center gap-2 rounded-2xl border border-border/60 bg-background/80 px-4 py-2.5 text-sm text-muted-foreground">
                  <InlineLoadingState label="Thinking..." className="text-sm" />
                </div>
              </div>
            )}
          </div>

          {/* Error banner */}
          {requestError && !loading && (
            <div className="shrink-0 border-t border-border/60 px-4 py-2.5">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <p className="min-w-0 flex-1 truncate text-xs text-amber-700 dark:text-amber-300">
                  {requestError}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={handleRetry}
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="shrink-0 border-t border-border/60 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
                placeholder="Ask a question about this topic..."
                className="flex-1 resize-none rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
              />
              {loading ? (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 shrink-0 self-end"
                  onClick={handleStopRequest}
                  title="Stop generation"
                >
                  <CircleStop className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim()}
                  className="h-10 w-10 shrink-0 self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </form>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
