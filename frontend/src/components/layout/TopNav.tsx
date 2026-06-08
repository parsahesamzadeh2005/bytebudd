"use client";

import { useState, useRef, useEffect } from "react";
import { Database, Pencil, Check, X } from "lucide-react";
import { DBConnection } from "@/types";
import { dbTypeColor, dbTypeLabel } from "@/lib/utils";

interface TopNavProps {
  title: string;
  dbConnection?: DBConnection | null;
  onTitleChange?: (newTitle: string) => Promise<void>;
}

export function TopNav({ title, dbConnection, onTitleChange }: TopNavProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync when title prop changes (e.g. after navigation)
  useEffect(() => {
    setValue(title);
  }, [title]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function commit() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === title) {
      setEditing(false);
      setValue(title);
      return;
    }
    setSaving(true);
    try {
      await onTitleChange?.(trimmed);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rename");
      setValue(title);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function cancel() {
    setValue(title);
    setEditing(false);
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
      {/* Title — editable when onTitleChange is provided */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") cancel();
              }}
              disabled={saving}
              className="flex-1 min-w-0 font-semibold text-gray-800 text-lg bg-gray-50 border border-blue-400 rounded-lg px-3 py-1 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={commit}
              disabled={saving}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-40"
              title="Save"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0 group">
            <h1 className="font-semibold text-gray-800 text-lg truncate">{title}</h1>
            {onTitleChange && (
              <button
                onClick={() => setEditing(true)}
                className="p-1 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                title="Rename conversation"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* DB badge */}
      {dbConnection && (
        <div className="flex items-center gap-2 shrink-0">
          <Database className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">{dbConnection.name}</span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${dbTypeColor(
              dbConnection.db_type
            )}`}
          >
            {dbTypeLabel(dbConnection.db_type)}
          </span>
        </div>
      )}
    </header>
  );
}
