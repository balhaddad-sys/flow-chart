"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, increment } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCourseStore } from "@/lib/stores/course-store";
import * as fn from "@/lib/firebase/functions";
import { ChatMessage } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ChatMessage as ChatMessageType } from "@/lib/types/chat";

export default function ChatThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = use(params);
  const router = useRouter();
  const { uid } = useAuth();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const courseId = useCourseStore((s) => s.activeCourseId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to messages
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "users", uid, "chatMessages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs
          .map((d) => ({ ...d.data(), id: d.id }) as ChatMessageType)
          .filter((m) => m.threadId === threadId)
      );
      setLoading(false);
    });
    return unsub;
  }, [uid, threadId]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(content: string) {
    if (!uid || !courseId) return;
    setSending(true);

    try {
      // The Cloud Function handles saving both user + assistant messages
      // and updating thread metadata, so we just call it.
      try {
        await fn.sendChatMessage({ threadId, message: content, courseId });
      } catch {
        // Fallback: save user message locally if Cloud Function isn't deployed yet
        await addDoc(collection(db, "users", uid, "chatMessages"), {
          threadId,
          role: "user",
          content,
          createdAt: serverTimestamp(),
        });
        await addDoc(collection(db, "users", uid, "chatMessages"), {
          threadId,
          role: "assistant",
          content: "The AI chat backend is being set up. This feature will be available once the sendChatMessage Cloud Function is deployed.",
          createdAt: serverTimestamp(),
        });
        const threadRef = doc(db, "users", uid, "chatThreads", threadId);
        await updateDoc(threadRef, {
          lastMessage: content,
          messageCount: increment(2),
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/chat")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">AI Chat</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={sending} />
    </div>
  );
}
