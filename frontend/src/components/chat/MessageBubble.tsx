"use client";

import { Bot, User, AlertCircle } from "lucide-react";
import { ChatMessage } from "@/types";
import { SqlPreview } from "./SqlPreview";
import { ResultPanel } from "./ResultPanel";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: ChatMessage;
  conversationId: number;
}

export function MessageBubble({ message, conversationId }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isStreaming = message.isStreaming;

  return (
    <div className={cn("flex gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3", isUser ? "justify-end" : "justify-start")}>
      {/* Avatar - assistant only */}
      {!isUser && (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-1">
          <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          "max-w-[75%] sm:max-w-[85%] lg:max-w-[60%] space-y-2 sm:space-y-3",
          isUser && "items-end"
        )}
      >
        {/* Text bubble */}
        {(message.content || isStreaming) && (
          <div
            className={cn(
              "rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base leading-relaxed word-break-break-word",
              isUser
                ? "bg-blue-600 text-white rounded-br-sm"
                : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
            )}
          >
            {isStreaming && !message.content ? (
              <ThinkingDots />
            ) : (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
        )}

        {/* Error */}
        {message.error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="break-words">{message.error}</p>
          </div>
        )}

        {/* SQL preview */}
        {message.sql && <SqlPreview sql={message.sql} />}

        {/* Data grid */}
        {message.results && !message.isStreaming && (
          <ResultPanel
            columns={message.results.columns}
            rows={message.results.rows}
            rowCount={message.results.row_count}
            conversationId={conversationId}
          />
        )}
      </div>

      {/* Avatar - user only */}
      {isUser && (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-600 flex items-center justify-center shrink-0 mt-1">
          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
        </div>
      )}
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="thinking-dots flex items-center gap-0.5 py-1">
      <span />
      <span />
      <span />
    </div>
  );
}
