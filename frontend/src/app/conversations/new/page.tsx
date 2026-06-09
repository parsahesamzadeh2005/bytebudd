"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { conversationApi, dbApi, authApi, streamQuery } from "@/lib/api";
import { Conversation, DBConnection, ChatMessage, SSEResultsEvent, User } from "@/types";
import { Sidebar, SidebarToggle } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ProfileSelector } from "@/components/ollama/ProfileSelector";
import { Send, Loader2, Database, ArrowRight } from "lucide-react";

/**
 * "New Conversation" page — the conversation is NOT created on the backend
 * until the user submits their first actual question.
 */
export default function NewConversationPage() {
  const router = useRouter();

  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [databases, setDatabases] = useState<DBConnection[]>([]);
  const [selectedDb, setSelectedDb] = useState<DBConnection | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Once a conversation is created, hold its ID for subsequent messages
  const conversationIdRef = useRef<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    loadData();
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadData() {
    try {
      const [convs, dbs, me] = await Promise.all([
        conversationApi.list() as Promise<Conversation[]>,
        dbApi.list() as Promise<DBConnection[]>,
        authApi.me() as Promise<User>,
      ]);
      setAllConversations(convs);
      setDatabases(dbs);
      setUser(me);
      if (dbs.length > 0) setSelectedDb(dbs[0]);
    } catch (err) {
      console.error("Failed to load new conversation data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();

    const question = input.trim();
    if (!question || isStreaming || !profileReady) return;
    if (!selectedDb) {
      router.push("/databases");
      return;
    }

    setInput("");
    setIsStreaming(true);

    // Add user message immediately
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
    };
    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      // Create the conversation on first submit
      if (conversationIdRef.current === null) {
        const conv = (await conversationApi.create(selectedDb.id)) as Conversation;
        conversationIdRef.current = conv.id;

        // Add to sidebar list
        setAllConversations((prev) => [conv, ...prev]);

        // Silently update the URL to reflect the real conversation ID
        // (replaceState avoids adding a back-stack entry for the /new route)
        window.history.replaceState(null, "", `/conversations/${conv.id}`);
      }

      const convId = conversationIdRef.current!;

      // Persist profile selection
      if (selectedProfileId !== null) {
        conversationApi
          .saveProfile(convId, selectedProfileId, selectedModel)
          .catch(() => {});
      }

      let sqlText = "";
      let resultsData: SSEResultsEvent | undefined;

      await streamQuery(
        question,
        convId,
        selectedDb.id,
        (event: string, data: unknown) => {
          const payload = data as Record<string, unknown>;
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== assistantId) return msg;
              if (event === "thinking") return { ...msg, content: String(payload.message || ""), isStreaming: true };
              if (event === "sql") { sqlText = String(payload.sql || ""); return { ...msg, sql: sqlText, isStreaming: true }; }
              if (event === "results") { resultsData = payload as unknown as SSEResultsEvent; return { ...msg, results: resultsData, isStreaming: true }; }
              if (event === "explanation") return { ...msg, content: String(payload.text || ""), sql: sqlText, results: resultsData, isStreaming: true };
              if (event === "error") return { ...msg, content: "", error: String(payload.message || "Unknown error"), isStreaming: false };
              return msg;
            })
          );
        },
        () => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantId ? { ...msg, isStreaming: false } : msg))
          );
          setIsStreaming(false);
        },
        (error: string) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId ? { ...msg, content: "", error, isStreaming: false } : msg
            )
          );
          setIsStreaming(false);
        },
        selectedProfileId,
        selectedModel,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId ? { ...msg, content: "", error: message, isStreaming: false } : msg
        )
      );
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // No databases — prompt to connect one
  if (databases.length === 0) {
    return (
      <div className="flex h-dvh overflow-hidden">
        <Sidebar
          conversations={allConversations}
          onNewConversation={() => router.push("/conversations/new")}
          onConversationsChange={setAllConversations}
          user={user}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 flex flex-col items-center justify-center bg-gray-50 gap-4 px-4">
          <Database className="w-12 h-12 text-gray-300" />
          <p className="text-gray-500 text-sm">No database connected yet.</p>
          <button
            onClick={() => router.push("/databases")}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            Connect a Database
            <ArrowRight className="w-4 h-4" />
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        conversations={allConversations}
        onNewConversation={() => {
          if (conversationIdRef.current === null) return;
          router.push("/conversations/new");
        }}
        onConversationsChange={setAllConversations}
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-h-0">
        <TopNav
          title="New Conversation"
          dbConnection={selectedDb}
          leftSlot={<SidebarToggle onClick={() => setSidebarOpen(true)} />}
        />

        {/* Chat area */}
        <div className="flex flex-col flex-1 min-h-0 bg-gray-50">
          <div className="flex-1 overflow-y-auto py-4">
            {messages.length === 0 ? (
              <EmptyState onExampleClick={(text) => setInput(text)} />
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t border-gray-200 bg-white px-3 sm:px-4 py-3 sm:py-4">
            <ProfileSelector
              initialProfileId={null}
              initialModel={null}
              onSelect={(profileId, modelName) => {
                if (profileId === -1) {
                  setSelectedProfileId(null);
                  setSelectedModel(null);
                  setProfileReady(false);
                } else {
                  setSelectedProfileId(profileId);
                  setSelectedModel(modelName);
                  setProfileReady(true);
                }
              }}
              disabled={isStreaming}
            />

            <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-3 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
                placeholder="Ask a question about your data…"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-300 px-3 sm:px-4 py-3 text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:opacity-50 min-h-[48px] max-h-32"
                style={{ overflowY: "auto" }}
              />
              <button
                type="submit"
                disabled={isStreaming || !input.trim() || !profileReady}
                className="w-11 h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition-colors shrink-0 touch-manipulation"
                aria-label="Send message"
              >
                {isStreaming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-2 text-center hidden sm:block">
              ByteBudd only runs read-only queries · Max 1000 rows
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onExampleClick }: { onExampleClick: (text: string) => void }) {
  const examples = [
    "Show me the last 10 orders",
    "How many users registered this month?",
    "What are the top 5 products by revenue?",
    "Show me all orders with status 'pending'",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="text-4xl mb-4">🤖</div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">
        Ask anything about your data
      </h2>
      <p className="text-gray-500 text-sm mb-8 max-w-sm">
        ByteBudd converts your questions into safe, read-only SQL queries using AI.
      </p>
      <div className="grid gap-2 w-full max-w-md">
        {examples.map((example) => (
          <button
            key={example}
            className="text-left text-sm px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors text-gray-600"
            onClick={() => onExampleClick(example)}
          >
            &ldquo;{example}&rdquo;
          </button>
        ))}
      </div>
    </div>
  );
}
