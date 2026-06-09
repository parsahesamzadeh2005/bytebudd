"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Cpu, Wifi, WifiOff, Download, Loader2, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";
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

  // Inline edit state for model / base_url
  const [editing, setEditing] = useState(false);
  const [editModel, setEditModel] = useState("");
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);

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

  function handleStartEdit() {
    setEditModel(ollamaStatus?.model ?? "");
    setEditBaseUrl(ollamaStatus?.base_url ?? "");
    setEditing(true);
  }

  function handleCancelEdit() {
    setEditing(false);
  }

  async function handleSaveConfig() {
    setSaving(true);
    try {
      const updated = await ollamaApi.updateConfig(editModel.trim(), editBaseUrl.trim());
      setOllamaStatus(updated);
      setEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update Ollama config");
    } finally {
      setSaving(false);
    }
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
            <div className="flex items-start justify-between flex-wrap gap-3">
              {/* Left: icon + info */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {statusLoading ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin mt-0.5 shrink-0" />
                ) : ollamaStatus === null ? (
                  <Wifi className="w-5 h-5 text-gray-300 mt-0.5 shrink-0" />
                ) : ollamaStatus.available ? (
                  <Wifi className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    Ollama —{" "}
                    {statusLoading
                      ? "Checking…"
                      : ollamaStatus === null
                      ? "Not checked"
                      : ollamaStatus.available
                      ? "Available"
                      : "Unavailable"}
                  </p>

                  {editing ? (
                    /* ── Edit form ── */
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 w-16 shrink-0">Model</label>
                        <input
                          type="text"
                          value={editModel}
                          onChange={(e) => setEditModel(e.target.value)}
                          placeholder="e.g. qwen3:14b"
                          className="flex-1 text-xs font-mono border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 w-16 shrink-0">Host URL</label>
                        <input
                          type="text"
                          value={editBaseUrl}
                          onChange={(e) => setEditBaseUrl(e.target.value)}
                          placeholder="e.g. http://192.168.1.99:11434"
                          className="flex-1 text-xs font-mono border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={handleSaveConfig}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
                        >
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
                        >
                          <X className="w-3 h-3" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Read-only display ── */
                    ollamaStatus && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-400">
                          Model: <span className="font-mono">{ollamaStatus.model}</span>
                          {" · "}
                          <span className="font-mono">{ollamaStatus.base_url}</span>
                        </p>
                        <button
                          onClick={handleStartEdit}
                          className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Edit model / host"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Right: action buttons */}
              {!editing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={checkOllamaStatus}
                    disabled={statusLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors"
                  >
                    {statusLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
                    {statusLoading ? "Checking…" : "Check"}
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
              )}
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
            envDefaultAvailable={ollamaStatus == null ? null : ollamaStatus.available}
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
