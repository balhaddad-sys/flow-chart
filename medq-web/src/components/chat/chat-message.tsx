"use client";

import { Badge } from "@/components/ui/badge";
import { Bot, User } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/lib/types/chat";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted border border-border/70"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-xl border p-3 text-sm ${
          isUser
            ? "border-primary/40 bg-primary text-primary-foreground shadow-[0_12px_22px_-16px_rgba(30,64,175,0.8)]"
            : "border-border/70 bg-muted/65"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.citations.map((cite, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {cite.sectionTitle}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
