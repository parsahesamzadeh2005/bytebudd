"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { conversationApi, dbApi, authApi } from "@/lib/api";
import { Conversation, DBConnection, User } from "@/types";
import { Sidebar, SidebarToggle } from "@/components/layout/Sidebar";
import { Database, MessageSquare, Plus, ArrowRight, Bot } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [databases, setDatabases] = useState<DBConnection[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    loadData();
  }, []);

  async function loadData() {
    try {
      const [convs, dbs, me] = await Promise.all([
        conversationApi.list() as Promise<Conversation[]>,
        dbApi.list() as Promise<DBConnection[]>,
        authApi.me() as Promise<User>,
      ]);
      setConversations(convs);
      setDatabases(dbs);
      setUser(me);
    } catch (err) {
      console.error("Failed to load home page data:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleNewConversation() {
    if (databases.length === 0) {
      router.push("/databases");
      return;
    }
    router.push("/conversations/new");
  }

  if (loading) return <LoadingScreen />;

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        conversations={conversations}
        onNewConversation={handleNewConversation}
        onConversationsChange={setConversations}
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <SidebarToggle onClick={() => setSidebarOpen(true)} />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">ByteBudd</span>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center bg-gray-50 overflow-y-auto px-4 py-8 sm:p-8">
          <div className="max-w-2xl w-full text-center">
            <div className="text-5xl sm:text-6xl mb-4 sm:mb-6">🤖</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
              Welcome to ByteBudd
            </h1>
            <p className="text-gray-500 mb-8 sm:mb-10 text-base sm:text-lg">
              Your self-hosted AI SQL assistant. Connect a database and start asking questions.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-8 sm:mb-10">
              <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 sm:gap-3 mb-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                  <span className="text-xl sm:text-2xl font-bold text-gray-900">{conversations.length}</span>
                </div>
                <p className="text-gray-500 text-xs sm:text-sm">Conversations</p>
              </div>
              <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 sm:gap-3 mb-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                    <Database className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  </div>
                  <span className="text-xl sm:text-2xl font-bold text-gray-900">{databases.length}</span>
                </div>
                <p className="text-gray-500 text-xs sm:text-sm">Databases Connected</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 sm:gap-4 justify-center">
              {databases.length === 0 ? (
                <button
                  onClick={() => router.push("/databases")}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 sm:px-6 py-3 rounded-xl transition-colors text-sm sm:text-base touch-manipulation"
                >
                  <Database className="w-4 h-4" />
                  Connect a Database
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleNewConversation}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 sm:px-6 py-3 rounded-xl transition-colors text-sm sm:text-base touch-manipulation"
                >
                  <Plus className="w-4 h-4" />
                  New Conversation
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Loading ByteBudd...</p>
      </div>
    </div>
  );
}
