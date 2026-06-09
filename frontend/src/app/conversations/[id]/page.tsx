"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { conversationApi, dbApi, authApi } from "@/lib/api";
import { Conversation, ConversationDetail, DBConnection, ChatMessage } from "@/types";
import { Sidebar, SidebarToggle } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { ChatWindow } from "@/components/chat/ChatWindow";

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const convId = Number(params.id);

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [dbConnection, setDbConnection] = useState<DBConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [databases, setDatabases] = useState<DBConnection[]>([]);
  const [user, setUser] = useState<import("@/types").User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    if (convId) loadData();
  }, [convId]);

  async function loadData() {
    setError(null);
    try {
      const [conv, convs, dbs, me] = await Promise.all([
        conversationApi.get(convId) as Promise<ConversationDetail>,
        conversationApi.list() as Promise<Conversation[]>,
        dbApi.list() as Promise<DBConnection[]>,
        authApi.me(),
      ]);
      setConversation(conv);
      setAllConversations(convs);
      setDatabases(dbs);
      setUser(me as import("@/types").User);

      if (conv.db_connection_id) {
        const db = dbs.find((d) => d.id === conv.db_connection_id);
        setDbConnection(db || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversation");
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  async function handleNewConversation() {
    if (databases.length === 0) {
      router.push("/databases");
      return;
    }
    router.push("/conversations/new");
  }

  async function handleTitleChange(newTitle: string) {
    await conversationApi.updateTitle(convId, newTitle);
    setConversation((prev) => prev ? { ...prev, title: newTitle } : prev);
    setAllConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, title: newTitle } : c))
    );
  }

  // Convert DB messages to ChatMessage format
  const initialMessages: ChatMessage[] = (conversation?.messages || []).map((msg) => {
    let results = undefined;
    if (msg.result_data) {
      try {
        results = JSON.parse(msg.result_data);
      } catch {
        // malformed stored data — skip silently
      }
    }
    return {
      id: String(msg.id),
      role: msg.role,
      content: msg.content,
      sql: msg.generated_sql || undefined,
      results,
    };
  });

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50 text-red-600">
        {error || "Conversation not found"}
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        conversations={allConversations}
        onNewConversation={handleNewConversation}
        onConversationsChange={setAllConversations}
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <TopNav
          title={conversation.title}
          dbConnection={dbConnection}
          onTitleChange={handleTitleChange}
          leftSlot={<SidebarToggle onClick={() => setSidebarOpen(true)} />}
        />

        {dbConnection ? (
          <div className="flex-1 min-h-0">
            <ChatWindow
              conversationId={convId}
              dbConnectionId={dbConnection.id}
              initialMessages={initialMessages}
              initialProfileId={conversation.ollama_profile_id}
              initialModelName={conversation.ollama_model_name}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 px-4 text-center">
            <p>No database connected to this conversation.</p>
          </div>
        )}
      </div>
    </div>
  );
}
