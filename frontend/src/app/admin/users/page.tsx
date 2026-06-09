"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { authApi, adminApi, conversationApi } from "@/lib/api";
import { User, Conversation } from "@/types";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Users,
  Plus,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";

interface UserRow {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create-user form
  const [showForm, setShowForm] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<"user" | "admin">("user");
  const [formError, setFormError] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // Per-row busy tracking
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/login"); return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [meData, userList, convs] = await Promise.all([
        authApi.me() as Promise<User>,
        adminApi.listUsers(),
        conversationApi.list() as Promise<Conversation[]>,
      ]);
      if (meData.role !== "admin") { router.push("/"); return; }
      setMe(meData);
      setUsers(userList);
      setConversations(convs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(user: UserRow) {
    setBusyId(user.id);
    try {
      const updated = await adminApi.updateUser(user.id, { is_active: !user.is_active });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleRole(user: UserRow) {
    setBusyId(user.id);
    const newRole = user.role === "admin" ? "user" : "admin";
    try {
      const updated = await adminApi.updateUser(user.id, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(user: UserRow) {
    if (!confirm(`Delete user "${user.email}"? This cannot be undone.`)) return;
    setBusyId(user.id);
    try {
      await adminApi.deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormSaving(true);
    try {
      const created = await adminApi.createUser(formEmail.trim(), formPassword, formRole);
      setUsers((prev) => [...prev, created]);
      setShowForm(false);
      setFormEmail("");
      setFormPassword("");
      setFormRole("user");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setFormSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        conversations={conversations}
        onNewConversation={() => router.push("/")}
        onConversationsChange={setConversations}
        user={me}
      />

      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-8">

          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">User Management</h1>
                <p className="text-sm text-gray-500">{users.length} account{users.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add User
            </button>
          </div>

          {/* Page-level error */}
          {error && (
            <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="flex-1">{error}</p>
              <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Create user form */}
          {showForm && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-6">
              <h2 className="font-semibold text-gray-900 mb-4">New User</h2>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="input w-full"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <div className="flex gap-3">
                    {(["user", "admin"] as const).map((r) => (
                      <label key={r} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="role"
                          value={r}
                          checked={formRole === r}
                          onChange={() => setFormRole(r)}
                          className="accent-blue-600"
                        />
                        <span className="text-sm capitalize text-gray-700">{r}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {formError}
                  </div>
                )}
                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={formSaving}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
                  >
                    {formSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {formSaving ? "Creating…" : "Create User"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setFormError(""); }}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users table */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isMe = user.id === me?.id;
                  const busy = busyId === user.id;
                  return (
                    <tr key={user.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-800 font-mono">
                        {user.email}
                        {isMe && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-sans">you</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          user.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          {user.role === "admin"
                            ? <ShieldCheck className="w-3 h-3" />
                            : <ShieldOff className="w-3 h-3" />}
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          user.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-600"
                        }`}>
                          {user.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Toggle active — pill switch matching Ollama Profiles style */}
                          {busy ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400 mx-1.5" />
                          ) : (
                            <button
                              onClick={() => handleToggleActive(user)}
                              disabled={isMe}
                              title={user.is_active ? "Disable account" : "Enable account"}
                              role="switch"
                              aria-checked={user.is_active}
                              aria-label={`${user.is_active ? "Disable" : "Enable"} ${user.email}`}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-30 ${
                                user.is_active ? "bg-blue-600" : "bg-gray-200"
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                  user.is_active ? "translate-x-[18px]" : "translate-x-0.5"
                                }`}
                              />
                            </button>
                          )}

                          {/* Toggle role */}
                          <button
                            onClick={() => handleToggleRole(user)}
                            disabled={busy || isMe}
                            title={user.role === "admin" ? "Demote to user" : "Promote to admin"}
                            className="p-1.5 rounded-lg transition-colors disabled:opacity-30 text-gray-400 hover:text-purple-600 hover:bg-purple-50"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={busy || isMe}
                            title="Delete user"
                            className="p-1.5 rounded-lg transition-colors disabled:opacity-30 text-gray-400 hover:text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      </main>
    </div>
  );
}
