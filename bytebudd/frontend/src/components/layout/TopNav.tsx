"use client";

import { Database } from "lucide-react";
import { DBConnection } from "@/types";
import { dbTypeColor, dbTypeLabel } from "@/lib/utils";

interface TopNavProps {
  title: string;
  dbConnection?: DBConnection | null;
}

export function TopNav({ title, dbConnection }: TopNavProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <h1 className="font-semibold text-gray-800 text-lg truncate">{title}</h1>

      {dbConnection && (
        <div className="flex items-center gap-2">
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
