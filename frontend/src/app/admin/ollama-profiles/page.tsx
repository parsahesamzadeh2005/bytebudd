"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Cpu, Wifi, WifiOff, Download, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";
import { authApi, ollamaProfileApi, ollamaApi, conversationApi } from "@/lib/api";
import { OllamaProfile, User, Conversation } from "@/types";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProfileList } from "@/components/ollama/ProfileList";
import { ProfileFormModal } from "@/components/ollama/ProfileFormModal";

export default function OllamaProfilesPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<OllamaProfile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ollama status state
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; model: string; base_url: string } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullLog, setPullLog] = useState<string[]>([]);
  const [showPullLog, setShowPullLog] = useState(false);
  const pullLogRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<OllamaProfile | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [me, profileList, convs] = await Promise.all([
        authApi.me() as Promise<User>,
        ollamaProfileApi.list(),
        conversationApi.list() as Promise<Conversation[]>,
      ]);

      if (me.role !== "admin") {
        router.push("/");
        return;
      }

      setUser(me);
      setProfiles(profileList);
      setConversations(convs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }

    // Check Ollama status in parallel (non-blocking)
    checkOllamaStatus();
  }

  async function checkOllamaStatus() {
    setStatusLoading(true);
    try {
      const status = await ollamaApi.status();
      setOllamaStatus(status);
    } catch (err) {
      setOllamaStatus({ available: false, model: "unknown", base_url: "" });
      console.error("Ollama status check failed:", err);
    } finally {
      setStatusLoading(false);
    }
  }

  async function handlePullModel() {
    setPulling(true);
    setPullLog([]);
    setShowPullLog(true);
    try {
      await ollamaApi.pull((msg) => {
        setPullLog((prev) => [...prev, msg]);
        // Auto-scroll log
        setTimeout(() => {
          pullLogRef.current?.scrollTo({ top: pullLogRef.current.scrollHeight, behavior: "smooth" });
        }, 50);
      });
      setPullLog((prev) => [...prev, "✓ Pull complete"]);
      // Refresh status
      await checkOllamaStatus();
    } catch (err) {
      setPullLog((prev) => [...prev, `✗ Error: ${err instanceof Error ? err.message : "Pull failed"}`]);
    } finally {
      setPulling(false);
    }
  }

  function handleOpenCreate() {
    setEditingProfile(null);
    setModalOpen(true);
  }

  function handleOpenEdit(profile: OllamaProfile) {
    setEditingProfile(profile);
    setModalOpen(true);
  }

  async function handleDelete(profile: OllamaProfile) {
    try {
      await ollamaProfileApi.delete(profile.id);
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete profile");
    }
  }

  async function handleToggleActive(profile: OllamaProfile) {
    try {
      const updated = await ollamaProfileApi.setActive(profile.id, !profile.is_active);
      setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update profile");
    }
  }

  function handleSaved(saved: OllamaProfile) {
    setProfiles((prev) => {
      const exists = prev.find((p) => p.id === saved.id);
      if (exists) {
        return prev.map((p) => (p.id === saved.id ? saved : p));
      }
      // New profile: insert at top (before env default at end)
      const envDefault = prev.find((p) => p.id === 0);
      const rest = prev.filter((p) => p.id !== 0);
      return envDefault ? [saved, ...rest, envDefault] : [saved, ...rest];
    });
  }

  async function handleNewConversation() {
    router.push("/");
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        conversations={conversations}
        onNewConversation={handleNewConversation}
        user={user}
      />

      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Cpu className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Ollama Profiles</h1>
                <p className="text-sm text-gray-500">
                  Manage AI model configurations for your users
                </p>
              </div>
            </div>
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Profile
            </button>
          </div>

          {/* Error state */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Ollama status card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {statusLoading ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                ) : ollamaStatus?.available ? (
                  <Wifi className="w-5 h-5 text-green-500" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Ollama —{" "}
                    {statusLoading
                      ? "Checking…"
                      : ollamaStatus?.available
                      ? "Available"
                      : "Unavailable"}
                  </p>
                  {ollamaStatus && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Model: <span className="font-mono">{ollamaStatus.model}</span>
                      {" · "}
                      <span className="font-mono">{ollamaStatus.base_url}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={checkOllamaStatus}
                  disabled={statusLoading}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  Refresh
                </button>
                <button
                  onClick={handlePullModel}
                  disabled={pulling}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
                >
                  {pulling ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  {pulling ? "Pulling…" : "Pull Model"}
                </button>
                {pullLog.length > 0 && (
                  <button
                    onClick={() => setShowPullLog((v) => !v)}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    {showPullLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Log
                  </button>
                )}
              </div>
            </div>
            {showPullLog && pullLog.length > 0 && (
              <div
                ref={pullLogRef}
                className="mt-3 bg-gray-900 rounded-xl p-3 max-h-40 overflow-y-auto"
              >
                {pullLog.map((line, i) => (
                  <p key={i} className="text-xs font-mono text-green-400 leading-5">{line}</p>
                ))}
              </div>
            )}
          </div>

          {/* Profile list */}
          <ProfileList
            profiles={profiles}
            loading={loading}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
            onToggleActive={handleToggleActive}
          />

          {/* Info note */}
          {!loading && profiles.length > 0 && (
            <p className="mt-4 text-xs text-gray-400 text-center">
              Active profiles are available to all users in the query interface.
              Multiple profiles can be active simultaneously.
            </p>
          )}
        </div>
      </main>

      {/* Create / Edit modal */}
      <ProfileFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        initialProfile={editingProfile}
      />
    </div>
  );
}
