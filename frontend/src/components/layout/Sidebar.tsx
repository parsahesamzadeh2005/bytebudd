"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Database,
  Plus,
  LogOut,
  Bot,
  Cpu,
  Trash2,
  Pencil,
  Check,
  X,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth";
import { conversationApi } from "@/lib/api";
import { Conversation, User } from "@/types";
import { useState } from "react";

interface SidebarProps {
  conversations: Conversation[];
  onNewConversation: () => void;
  onConversationsChange?: (conversations: Conversation[]) => void;
  user?: User | null;
}

export function Sidebar({
  conversations,
  onNewConversation,
  onConversationsChange,
  user,
}: SidebarProps) {
  const pathname = usePathname();
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    try {
      await conversationApi.delete(id);
      onConversationsChange?.(conversations.filter((c) => c.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete conversation");
    }
  }

  function startRename(e: React.MouseEvent, conv: Conversation) {
    e.preventDefault();
    e.stopPropagation();
    setRenamingId(conv.id);
    setRenameValue(conv.title);
  }

  async function commitRename(id: number) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    try {
      await conversationApi.updateTitle(id, trimmed);
      onConversationsChange?.(
        conversations.map((c) => (c.id === id ? { ...c, title: trimmed } : c))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rename conversation");
    } finally {
      setRenamingId(null);
    }
  }

  function cancelRename() {
    setRenamingId(null);
  }

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg">ByteBudd</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-3 border-b border-gray-700">
        <NavLink href="/" icon={<MessageSquare className="w-4 h-4" />} active={pathname === "/"}>
          Conversations
        </NavLink>
        <NavLink href="/databases" icon={<Database className="w-4 h-4" />} active={pathname === "/databases"}>
          Databases
        </NavLink>
        {user?.role === "admin" && (
          <>
            <NavLink
              href="/admin/ollama-profiles"
              icon={<Cpu className="w-4 h-4" />}
              active={pathname.startsWith("/admin/ollama-profiles")}
            >
              Ollama Profiles
            </NavLink>
            <NavLink
              href="/admin/users"
              icon={<Users className="w-4 h-4" />}
              active={pathname.startsWith("/admin/users")}
            >
              User Management
            </NavLink>
          </>
        )}
      </nav>

      {/* New conversation button */}
      <div className="p-3">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto p-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider px-2 mb-2">
          Recent
        </p>
        {conversations.length === 0 ? (
          <p className="text-gray-500 text-xs px-2">No conversations yet</p>
        ) : (
          conversations.map((conv) => {
            const isActive = pathname === `/conversations/${conv.id}`;
            const isRenaming = renamingId === conv.id;

            return (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-1 px-2 py-1.5 rounded-lg mb-0.5 transition-colors",
                  isActive ? "bg-gray-700" : "hover:bg-gray-800"
                )}
              >
                {isRenaming ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(conv.id);
                        if (e.key === "Escape") cancelRename();
                      }}
                      className="flex-1 min-w-0 bg-gray-600 text-white text-xs px-2 py-1 rounded outline-none border border-blue-500"
                    />
                    <button
                      onClick={() => commitRename(conv.id)}
                      className="p-0.5 text-green-400 hover:text-green-300"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={cancelRename}
                      className="p-0.5 text-gray-400 hover:text-gray-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Link
                      href={`/conversations/${conv.id}`}
                      className="flex items-center gap-2 flex-1 min-w-0"
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                      <span
                        className={cn(
                          "truncate text-sm",
                          isActive ? "text-white" : "text-gray-400"
                        )}
                      >
                        {conv.title}
                      </span>
                    </Link>
                    {/* Action buttons — visible on hover or when active */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) => startRename(e, conv)}
                        title="Rename"
                        className="p-1 text-gray-500 hover:text-gray-200 rounded"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, conv.id)}
                        title="Delete"
                        className="p-1 text-gray-500 hover:text-red-400 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Logout */}
      <div className="p-3 border-t border-gray-700">
        {user && (
          <p className="text-xs text-gray-500 px-3 mb-2 truncate">{user.email}</p>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  icon,
  active,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm rounded-lg mb-1 transition-colors",
        active
          ? "bg-gray-700 text-white"
          : "text-gray-400 hover:bg-gray-800 hover:text-white"
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
