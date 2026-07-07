"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Cpu, Loader2, RefreshCw, Download, CheckCircle, XCircle } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";
import { authApi, ollamaProfileApi, ollamaApi, conversationApi } from "@/lib/api";
import { OllamaProfile, User, Conversation } from "@/types";
import { Sidebar, SidebarToggle } from "@/components/layout/Sidebar";
import { ProfileList } from "@/components/ollama/ProfileList";
import { ProfileFormModal } from "@/components/ollama/ProfileFormModal";

interface OllamaStatus {
  available: boolean;
  model: string;
  base_url: string;
}

export default function OllamaProfilesPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<OllamaProfile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Global Ollama config state
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [configModel, setConfigModel] = useState("");
  const [configBaseUrl, setConfigBaseUrl] = useState("");
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullLog, setPullLog] = useState<string[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<OllamaProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      const [me, profileList, convs, status] = await Promise.all([
        authApi.me() as Promise<User>,
        ollamaProfileApi.list(),
        conversationApi.list() as Promise<Conversation[]>,
        ollamaApi.status(),
      ]);

      if (me.role !== "admin") {
        router.push("/");
        return;
      }

      setUser(me);
      setProfiles(profileList);
      setConversations(convs);
      setOllamaStatus(status);
      setConfigModel(status.model);
      setConfigBaseUrl(status.base_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfigSave() {
    setConfigSaving(true);
    setConfigError(null);
    setConfigSuccess(false);
    try {
      const updated = await ollamaApi.updateConfig(configModel.trim(), configBaseUrl.trim());
      setOllamaStatus(updated);
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 3000);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "Failed to update config");
    } finally {
      setConfigSaving(false);
    }
  }

  async function handlePullModel() {
    setPulling(true);
    setPullLog([]);
    try {
      await ollamaApi.pull((msg) => {
        setPullLog((prev) => [...prev, msg]);
      });
      // Refresh status after pull
      const status = await ollamaApi.status();
      setOllamaStatus(status);
    } catch (err) {
      setPullLog((prev) => [
        ...prev,
        `Error: ${err instanceof Error ? err.message : "Pull failed"}`,
      ]);
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
      const envDefault = prev.find((p) => p.id === 0);
      const rest = prev.filter((p) => p.id !== 0);
      return envDefault ? [saved, ...rest, envDefault] : [saved, ...rest];
    });
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        conversations={conversations}
        onNewConversation={() => router.push("/")}
        onConversationsChange={setConversations}
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 overflow-y-auto bg-gray-50">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
          <SidebarToggle onClick={() => setSidebarOpen(true)} />
          <h1 className="font-semibold text-gray-800 text-base">Ollama Profiles</h1>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
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

          {/* Page-level error */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* ── Global Ollama Config Card ─────────────────────────────── */}
          {ollamaStatus !== null && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Global Ollama Config
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Environment-level fallback used when no profile is selected.
                  </p>
                </div>
                {/* Availability badge */}
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                    ollamaStatus.available
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-600 border border-red-200"
                  }`}
                >
                  {ollamaStatus.available ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {ollamaStatus.available ? "Reachable" : "Unreachable"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={configBaseUrl}
                    onChange={(e) => setConfigBaseUrl(e.target.value)}
                    placeholder="http://host.docker.internal:11434"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    value={configModel}
                    onChange={(e) => setConfigModel(e.target.value)}
                    placeholder="qwen2.5-coder:8b"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {configError && (
                <p className="text-xs text-red-600 mb-3">{configError}</p>
              )}
              {configSuccess && (
                <p className="text-xs text-green-600 mb-3">Config updated successfully.</p>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleConfigSave}
                  disabled={configSaving || !configModel.trim() || !configBaseUrl.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
                >
                  {configSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  {configSaving ? "Saving…" : "Update Config"}
                </button>

                <button
                  onClick={handlePullModel}
                  disabled={pulling}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 rounded-lg transition-colors"
                >
                  {pulling ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  {pulling ? "Pulling…" : "Pull model"}
                </button>
              </div>

              {/* Pull progress log */}
              {pullLog.length > 0 && (
                <div className="mt-3 bg-gray-900 rounded-lg p-3 max-h-28 overflow-y-auto">
                  {pullLog.map((line, i) => (
                    <p key={i} className="text-xs font-mono text-green-400 leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Profile list ─────────────────────────────────────────── */}
          <ProfileList
            profiles={profiles}
            loading={loading}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
            onToggleActive={handleToggleActive}
          />

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
