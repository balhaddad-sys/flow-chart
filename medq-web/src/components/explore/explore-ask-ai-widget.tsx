"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  MessageCircle,
  X,
  Send,
  Trash2,
  CircleStop,
  Sparkles,
  RotateCcw,
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
    const id = window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.clearTimeout(id);
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
        const idToken = await user?.getIdToken();
        const res = await fetch("/api/explore-chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          signal: controller.signal,
          body: JSON.stringify({
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
          }),
        });

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
    setMessages([]);
    setRequestError(null);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore localStorage failures.
    }
  }

  if (!topicInsight) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-primary/35 bg-gradient-to-br from-primary to-sky-500 text-primary-foreground shadow-[0_16px_30px_-18px_rgba(37,99,235,0.95)] transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
        aria-label="Ask AI about this topic"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 flex h-[520px] w-[min(92vw,430px)] max-h-[72vh] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.9)] backdrop-blur-xl md:bottom-6 md:right-6">
      <div className="border-b border-border/60 bg-gradient-to-r from-primary/14 via-primary/6 to-transparent px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              Ask AI: {topic}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Context-aware tutor with cached quick replies
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

      <div className="border-b border-border/60 px-3 py-2">
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

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 rounded-2xl border border-primary/25 bg-primary/10 p-2.5">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Ask anything about{" "}
              <span className="font-medium text-foreground">{topic}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground/75">
              Use the quick prompts above, then keep drilling with follow-up questions.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
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
            <div className="mr-5 flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-sm text-muted-foreground">
              <InlineLoadingState label="Thinking..." className="text-sm" />
            </div>
          </div>
        )}
      </div>

      {requestError && !loading && (
        <div className="border-t border-border/60 px-3 py-2">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
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
          {loading ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9 shrink-0"
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
              className="h-9 w-9 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
