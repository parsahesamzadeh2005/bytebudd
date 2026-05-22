"use client";

import { Bot, User, AlertCircle } from "lucide-react";
import { ChatMessage } from "@/types";
import { SqlPreview } from "./SqlPreview";
import { DataGrid } from "./DataGrid";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isStreaming = message.isStreaming;

  return (
    <div className={cn("flex gap-3 px-4 py-3", isUser ? "justify-end" : "justify-start")}>
      {/* Avatar - assistant only */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-1">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Content */}
      <div className={cn("max-w-[85%] space-y-3", isUser && "items-end")}>
        {/* Text bubble */}
        {(message.content || isStreaming) && (
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-sm leading-relaxed",
              isUser
                ? "bg-blue-600 text-white rounded-br-sm"
                : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
            )}
          >
            {isStreaming && !message.content ? (
              <ThinkingDots />
            ) : (
              <p className="whitespace-pre-wrap">{message.content}</p>
            )}
          </div>
        )}

        {/* Error */}
        {message.error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{message.error}</p>
          </div>
        )}

        {/* SQL preview */}
        {message.sql && <SqlPreview sql={message.sql} />}

        {/* Data grid */}
        {message.results && !message.isStreaming && (
          <DataGrid
            columns={message.results.columns}
            rows={message.results.rows}
            rowCount={message.results.row_count}
          />
        )}
      </div>

      {/* Avatar - user only */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center shrink-0 mt-1">
          <User className="w-4 h-4 text-white" />
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
