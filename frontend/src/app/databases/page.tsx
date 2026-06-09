"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { dbApi, conversationApi, authApi } from "@/lib/api";
import { DBConnection, DBConnectionCreate, Conversation, User } from "@/types";
import { Sidebar, SidebarToggle } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import {
  Database,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Edit2,
  Code2,
  X,
} from "lucide-react";
import { dbTypeColor, dbTypeLabel } from "@/lib/utils";

// Update payload — same shape as Create but all fields optional except what we send
interface DBConnectionUpdate {
  name?: string;
  host?: string;
  port?: number;
  database_name?: string;
  username?: string;
  password?: string;
  sqlite_path?: string;
  instance_name?: string;
  odbc_driver?: string;
}

export default function DatabasesPage() {
  const router = useRouter();
  const [databases, setDatabases] = useState<DBConnection[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDb, setEditingDb] = useState<DBConnection | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string }>>({});
  const [schemaDb, setSchemaDb] = useState<DBConnection | null>(null);
  const [schemaContent, setSchemaContent] = useState<string | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
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
      const [dbs, convs, me] = await Promise.all([
        dbApi.list() as Promise<DBConnection[]>,
        conversationApi.list() as Promise<Conversation[]>,
        authApi.me() as Promise<User>,
      ]);
      setDatabases(dbs);
      setConversations(convs);
      setUser(me);
    } catch (err) {
      console.error("Failed to load databases:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleTest(id: number) {
    setTestingId(id);
    try {
      const result = await dbApi.test(id);
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: result.success, message: result.message },
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Test failed";
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, message },
      }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this database connection?")) return;
    try {
      await dbApi.delete(id);
      setDatabases((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete connection");
    }
  }

  async function handleViewSchema(db: DBConnection) {
    if (schemaDb?.id === db.id) {
      // toggle off
      setSchemaDb(null);
      setSchemaContent(null);
      return;
    }
    setSchemaDb(db);
    setSchemaContent(null);
    setSchemaLoading(true);
    try {
      const result = await dbApi.getSchema(db.id);
      setSchemaContent(result.schema);
    } catch (err) {
      setSchemaContent(`Error: ${err instanceof Error ? err.message : "Failed to load schema"}`);
    } finally {
      setSchemaLoading(false);
    }
  }

  async function handleCreate(data: DBConnectionCreate) {
    const created = (await dbApi.create(data)) as DBConnection;
    setDatabases((prev) => [...prev, created]);
    setShowForm(false);
  }

  async function handleUpdate(id: number, data: DBConnectionUpdate) {
    const updated = (await dbApi.update(id, data)) as DBConnection;
    setDatabases((prev) => prev.map((d) => (d.id === id ? updated : d)));
    setEditingDb(null);
  }

  async function handleNewConversation() {
    if (databases.length === 0) return;
    const conv = (await conversationApi.create(databases[0].id)) as Conversation;
    router.push(`/conversations/${conv.id}`);
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        conversations={conversations}
        onNewConversation={handleNewConversation}
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-h-0">
        <TopNav
          title="Database Connections"
          leftSlot={<SidebarToggle onClick={() => setSidebarOpen(true)} />}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Add button */}
          <div className="flex justify-between items-center mb-6">
            <p className="text-gray-500 text-sm">
              {databases.length} connection{databases.length !== 1 ? "s" : ""} configured
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Connection
            </button>
          </div>

          {/* Add connection form */}
          {showForm && (
            <AddConnectionForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
            />
          )}

          {/* Database list */}
          {databases.length === 0 && !showForm ? (
            <EmptyState onAdd={() => setShowForm(true)} />
          ) : (
            <div className="grid gap-4">
              {databases.map((db) => (
                <div key={db.id}>
                  <DBCard
                    db={db}
                    testing={testingId === db.id}
                    testResult={testResults[db.id]}
                    onTest={() => handleTest(db.id)}
                    onDelete={() => handleDelete(db.id)}
                    onEdit={() => {
                      setShowForm(false);
                      setEditingDb(editingDb?.id === db.id ? null : db);
                    }}
                    onViewSchema={() => handleViewSchema(db)}
                    schemaActive={schemaDb?.id === db.id}
                    onConnect={async () => {
                      const conv = (await conversationApi.create(db.id, `Chat with ${db.name}`)) as Conversation;
                      router.push(`/conversations/${conv.id}`);
                    }}
                  />
                  {editingDb?.id === db.id && (
                    <EditConnectionForm
                      db={editingDb}
                      onSubmit={(data) => handleUpdate(db.id, data)}
                      onCancel={() => setEditingDb(null)}
                    />
                  )}
                  {schemaDb?.id === db.id && (
                    <div className="mt-2 bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700">
                        <span className="text-xs font-medium text-gray-300">Schema — {db.name}</span>
                        <button
                          onClick={() => { setSchemaDb(null); setSchemaContent(null); }}
                          className="p-1 text-gray-500 hover:text-gray-300 rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="max-h-96 overflow-y-auto p-4">
                        {schemaLoading ? (
                          <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading schema…
                          </div>
                        ) : (
                          <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap leading-relaxed">
                            {schemaContent}
                          </pre>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function DBCard({
  db,
  testing,
  testResult,
  onTest,
  onDelete,
  onEdit,
  onViewSchema,
  schemaActive,
  onConnect,
}: {
  db: DBConnection;
  testing: boolean;
  testResult?: { success: boolean; message: string };
  onTest: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onViewSchema: () => void;
  schemaActive: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Top row: info + action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        {/* DB info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{db.name}</h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${dbTypeColor(db.db_type)}`}>
                {dbTypeLabel(db.db_type)}
              </span>
              {db.host && (
                <span className="text-xs text-gray-400 truncate">
                  {db.host}:{db.port} / {db.database_name}
                </span>
              )}
              {db.db_type === "sqlite" && (
                <span className="text-xs text-gray-400 truncate">{db.database_name}</span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons — wrap on mobile */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <button
            onClick={onTest}
            disabled={testing}
            className="text-xs px-3 py-1.5 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 touch-manipulation"
          >
            {testing ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Testing...
              </>
            ) : (
              "Test"
            )}
          </button>

          <button
            onClick={onConnect}
            className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors touch-manipulation"
          >
            Chat
          </button>

          <button
            onClick={onEdit}
            title="Edit connection"
            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors touch-manipulation"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            onClick={onViewSchema}
            title="View schema"
            className={`p-1.5 rounded-lg transition-colors touch-manipulation ${
              schemaActive
                ? "text-green-600 bg-green-50"
                : "text-gray-400 hover:text-green-600 hover:bg-green-50"
            }`}
          >
            <Code2 className="w-4 h-4" />
          </button>

          <button
            onClick={onDelete}
            title="Delete connection"
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors touch-manipulation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={`mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
            testResult.success
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {testResult.success ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0" />
          )}
          <span className="break-words">{testResult.message}</span>
        </div>
      )}
    </div>
  );
}

function AddConnectionForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: DBConnectionCreate) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<DBConnectionCreate>({
    name: "",
    db_type: "postgresql",
    host: "",
    port: 5432,
    database_name: "",
    username: "",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField<K extends keyof DBConnectionCreate>(
    key: K,
    value: DBConnectionCreate[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  const isSqlite = form.db_type === "sqlite";
  const isMssql = form.db_type === "mssql";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-4">
      <h2 className="font-semibold text-gray-900 mb-4">Add Database Connection</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Name */}
          <FormField label="Connection Name" required>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="My Production DB"
              className="input"
            />
          </FormField>

          {/* Type */}
          <FormField label="Database Type" required>
            <select
              value={form.db_type}
              onChange={(e) => {
                const t = e.target.value as DBConnectionCreate["db_type"];
                updateField("db_type", t);
                updateField(
                  "port",
                  t === "mysql" || t === "mariadb" ? 3306
                  : t === "postgresql" ? 5432
                  : t === "mssql" ? 1433
                  : undefined
                );
              }}
              className="input"
            >
              <option value="postgresql">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="mariadb">MariaDB</option>
              <option value="sqlite">SQLite</option>
              <option value="mssql">SQL Server (MSSQL)</option>
            </select>
          </FormField>
        </div>

        {isSqlite ? (
          <FormField label="SQLite File Path" required>
            <input
              type="text"
              required
              value={form.sqlite_path || ""}
              onChange={(e) => updateField("sqlite_path", e.target.value)}
              placeholder="/path/to/database.db"
              className="input"
            />
          </FormField>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <FormField label="Host" required>
                  <input
                    type="text"
                    required
                    value={form.host || ""}
                    onChange={(e) => updateField("host", e.target.value)}
                    placeholder="localhost or IP"
                    className="input"
                  />
                </FormField>
              </div>
              <FormField label="Port">
                <input
                  type="number"
                  value={form.port || ""}
                  onChange={(e) => updateField("port", Number(e.target.value))}
                  className="input"
                />
              </FormField>
            </div>

            <FormField label="Database Name" required>
              <input
                type="text"
                required
                value={form.database_name}
                onChange={(e) => updateField("database_name", e.target.value)}
                placeholder="my_database"
                className="input"
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Username">
                <input
                  type="text"
                  value={form.username || ""}
                  onChange={(e) => updateField("username", e.target.value)}
                  placeholder="db_user"
                  className="input"
                />
              </FormField>
              <FormField label="Password">
                <input
                  type="password"
                  value={form.password || ""}
                  onChange={(e) => updateField("password", e.target.value)}
                  placeholder="••••••••"
                  className="input"
                />
              </FormField>
            </div>

            {isMssql && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Instance Name">
                  <input
                    type="text"
                    value={form.instance_name || ""}
                    onChange={(e) => updateField("instance_name", e.target.value)}
                    placeholder="SQLEXPRESS (leave blank for default)"
                    className="input"
                  />
                </FormField>
                <FormField label="ODBC Driver">
                  <input
                    type="text"
                    value={form.odbc_driver || ""}
                    onChange={(e) => updateField("odbc_driver", e.target.value)}
                    placeholder="ODBC Driver 18 for SQL Server"
                    className="input"
                  />
                </FormField>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? "Saving..." : "Save Connection"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function EditConnectionForm({
  db,
  onSubmit,
  onCancel,
}: {
  db: DBConnection;
  onSubmit: (data: DBConnectionUpdate) => Promise<void>;
  onCancel: () => void;
}) {
  const isSqlite = db.db_type === "sqlite";
  const isMssql = db.db_type === "mssql";

  const [form, setForm] = useState<DBConnectionUpdate>({
    name: db.name,
    host: db.host ?? "",
    port: db.port ?? undefined,
    database_name: db.database_name,
    username: db.username ?? "",
    password: "",
    sqlite_path: db.database_name, // sqlite stores path in database_name
    instance_name: db.instance_name ?? "",
    odbc_driver: db.odbc_driver ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField<K extends keyof DBConnectionUpdate>(
    key: K,
    value: DBConnectionUpdate[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      // Only send password if the user typed something
      const payload: DBConnectionUpdate = { ...form };
      if (!payload.password) delete payload.password;
      await onSubmit(payload);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 shadow-sm mt-2 mb-2">
      <h2 className="font-semibold text-gray-900 mb-1">Edit Connection</h2>
      <p className="text-xs text-gray-500 mb-4">
        Database type cannot be changed. Leave password blank to keep the existing one.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Connection Name" required>
          <input
            type="text"
            required
            value={form.name ?? ""}
            onChange={(e) => updateField("name", e.target.value)}
            className="input"
          />
        </FormField>

        {isSqlite ? (
          <FormField label="SQLite File Path" required>
            <input
              type="text"
              required
              value={form.sqlite_path ?? ""}
              onChange={(e) => updateField("sqlite_path", e.target.value)}
              placeholder="/path/to/database.db"
              className="input"
            />
          </FormField>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <FormField label="Host" required>
                  <input
                    type="text"
                    required
                    value={form.host ?? ""}
                    onChange={(e) => updateField("host", e.target.value)}
                    placeholder="localhost or IP"
                    className="input"
                  />
                </FormField>
              </div>
              <FormField label="Port">
                <input
                  type="number"
                  value={form.port ?? ""}
                  onChange={(e) => updateField("port", Number(e.target.value))}
                  className="input"
                />
              </FormField>
            </div>

            <FormField label="Database Name" required>
              <input
                type="text"
                required
                value={form.database_name ?? ""}
                onChange={(e) => updateField("database_name", e.target.value)}
                className="input"
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Username">
                <input
                  type="text"
                  value={form.username ?? ""}
                  onChange={(e) => updateField("username", e.target.value)}
                  placeholder="db_user"
                  className="input"
                />
              </FormField>
              <FormField label="New Password">
                <input
                  type="password"
                  value={form.password ?? ""}
                  onChange={(e) => updateField("password", e.target.value)}
                  placeholder="Leave blank to keep current"
                  className="input"
                />
              </FormField>
            </div>

            {isMssql && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Instance Name">
                  <input
                    type="text"
                    value={form.instance_name ?? ""}
                    onChange={(e) => updateField("instance_name", e.target.value)}
                    placeholder="SQLEXPRESS (leave blank for default)"
                    className="input"
                  />
                </FormField>
                <FormField label="ODBC Driver">
                  <input
                    type="text"
                    value={form.odbc_driver ?? ""}
                    onChange={(e) => updateField("odbc_driver", e.target.value)}
                    placeholder="ODBC Driver 18 for SQL Server"
                    className="input"
                  />
                </FormField>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Database className="w-8 h-8 text-gray-400" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">No databases connected</h2>
      <p className="text-gray-500 text-sm mb-6">
        Add a database connection to start asking questions about your data.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl transition-colors mx-auto"
      >
        <Plus className="w-4 h-4" />
        Add Your First Database
      </button>
    </div>
  );
}
