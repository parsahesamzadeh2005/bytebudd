"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, Loader2, Lock, Wifi, WifiOff } from "lucide-react";
import { OllamaProfile } from "@/types";
import { ollamaProfileApi } from "@/lib/api";

interface AvailabilityResult {
  available: boolean;
  message: string;
  models: string[];
}

interface ProfileListProps {
  profiles: OllamaProfile[];
  loading: boolean;
  onEdit: (profile: OllamaProfile) => void;
  onDelete: (profile: OllamaProfile) => void;
  onToggleActive: (profile: OllamaProfile) => void;
  /** Availability of the Environment Default (id=0) — provided by the parent
   *  which already checks ollamaApi.status() on mount. */
  envDefaultAvailable?: boolean | null;
}

export function ProfileList({
  profiles,
  loading,
  onEdit,
  onDelete,
  onToggleActive,
  envDefaultAvailable,
}: ProfileListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  /** Profiles currently being checked (set of ids) */
  const [checkingIds, setCheckingIds] = useState<Set<number>>(new Set());
  /** Per-profile availability results */
  const [availability, setAvailability] = useState<Record<number, AvailabilityResult>>({});

  // ── Auto-check all real profiles when the list first loads ──────────────
  useEffect(() => {
    if (loading || profiles.length === 0) return;

    const realProfiles = profiles.filter((p) => p.id !== 0);
    if (realProfiles.length === 0) return;

    // Run all checks in parallel without blocking the UI
    realProfiles.forEach((p) => checkAvailability(p, /* silent */ true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]); // run once when loading transitions to false

  async function checkAvailability(profile: OllamaProfile, silent = false) {
    setCheckingIds((prev) => new Set(prev).add(profile.id));
    try {
      const result = await ollamaProfileApi.checkAvailability(profile.id);
      setAvailability((prev) => ({ ...prev, [profile.id]: result }));
    } catch (err) {
      if (!silent) {
        const msg = err instanceof Error ? err.message : "Check failed";
        setAvailability((prev) => ({
          ...prev,
          [profile.id]: { available: false, message: `Unreachable: ${msg}`, models: [] },
        }));
      }
    } finally {
      setCheckingIds((prev) => {
        const next = new Set(prev);
        next.delete(profile.id);
        return next;
      });
    }
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading profiles…
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">No profiles configured yet.</p>
        <p className="text-xs mt-1">Click &ldquo;Add Profile&rdquo; to get started.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Host URL</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Models</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Active</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Host</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {profiles.map((profile) => {
            const isEnvDefault = profile.id === 0;
            const isConfirmingDelete = confirmDeleteId === profile.id;
            const isChecking = checkingIds.has(profile.id);
            const availResult = isEnvDefault
              ? envDefaultAvailable == null
                ? null
                : { available: envDefaultAvailable, message: "", models: [] }
              : availability[profile.id] ?? null;

            return (
              <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                {/* Name */}
                <td className="px-4 py-3 font-medium text-gray-900">
                  <div className="flex items-center gap-2">
                    {profile.name}
                    {isEnvDefault && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                        <Lock className="w-3 h-3" />
                        read-only
                      </span>
                    )}
                  </div>
                </td>

                {/* Host URL */}
                <td className="px-4 py-3 text-gray-500 font-mono text-xs max-w-[200px] truncate">
                  {profile.host_url || "—"}
                </td>

                {/* Models */}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {profile.models.length === 0 ? (
                      <span className="text-gray-400 text-xs">—</span>
                    ) : (
                      profile.models.slice(0, 3).map((m) => (
                        <span
                          key={m}
                          className="inline-block bg-blue-50 text-blue-700 text-xs rounded px-1.5 py-0.5 font-mono"
                        >
                          {m}
                        </span>
                      ))
                    )}
                    {profile.models.length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{profile.models.length - 3} more
                      </span>
                    )}
                  </div>
                </td>

                {/* Active toggle */}
                <td className="px-4 py-3">
                  {isEnvDefault ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={() => onToggleActive(profile)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                        profile.is_active ? "bg-blue-600" : "bg-gray-200"
                      }`}
                      role="switch"
                      aria-checked={profile.is_active}
                      aria-label={`${profile.is_active ? "Deactivate" : "Activate"} ${profile.name}`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          profile.is_active ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  )}
                </td>

                {/* Host availability badge */}
                <td className="px-4 py-3">
                  {isChecking ? (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Checking…
                    </span>
                  ) : availResult === null ? (
                    <span className="text-xs text-gray-300">—</span>
                  ) : availResult.available ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                      <Wifi className="w-3 h-3" />
                      Reachable
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                      <WifiOff className="w-3 h-3" />
                      Unreachable
                    </span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  {isEnvDefault ? (
                    <span className="text-xs text-gray-400">—</span>
                  ) : isConfirmingDelete ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-gray-500">Delete?</span>
                      <button
                        onClick={() => { setConfirmDeleteId(null); onDelete(profile); }}
                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      {/* Re-check button */}
                      <button
                        onClick={() => checkAvailability(profile)}
                        disabled={isChecking}
                        title="Re-check availability"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40"
                      >
                        {isChecking
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Wifi className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => onEdit(profile)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        aria-label={`Edit ${profile.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(profile.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        aria-label={`Delete ${profile.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
