"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Bot, User } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/lib/types/chat";

/** Render light markdown (bold, italic, inline code, bullet lists). */
function renderMarkdown(text: string): React.ReactNode[] {
  return text.split("\n").map((line, li) => {
    const trimmed = line.trimStart();
    const isBullet = /^[-*]\s/.test(trimmed);
    const content = isBullet ? trimmed.slice(2) : line;

    // Inline formatting: **bold**, *italic*, `code`
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      if (match.index > last) parts.push(content.slice(last, match.index));
      if (match[2]) parts.push(<strong key={`${li}-b-${match.index}`}>{match[2]}</strong>);
      else if (match[3]) parts.push(<em key={`${li}-i-${match.index}`}>{match[3]}</em>);
      else if (match[4])
        parts.push(
          <code key={`${li}-c-${match.index}`} className="rounded bg-black/10 px-1 py-0.5 text-[0.85em]">
            {match[4]}
          </code>
        );
      last = match.index + match[0].length;
    }
    if (last < content.length) parts.push(content.slice(last));

    if (isBullet) {
      return (
        <li key={li} className="ml-4 list-disc">
          {parts}
        </li>
      );
    }
    return (
      <React.Fragment key={li}>
        {li > 0 && "\n"}
        {parts}
      </React.Fragment>
    );
  });
}

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
        <div className="whitespace-pre-wrap">{isUser ? message.content : renderMarkdown(message.content)}</div>
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
