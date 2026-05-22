"use client";

import { useState } from "react";
import { Table2, ChevronLeft, ChevronRight } from "lucide-react";

interface DataGridProps {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

const PAGE_SIZE = 20;

export function DataGrid({ columns, rows, rowCount }: DataGridProps) {
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const visibleRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (columns.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-500">
        Query returned no results.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 text-gray-600">
          <Table2 className="w-4 h-4" />
          <span className="text-sm font-medium">
            {rowCount} row{rowCount !== 1 ? "s" : ""}
          </span>
        </div>
        {rowCount === 1000 && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            Limit reached (1000 rows)
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-72">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="text-left px-3 py-2 font-medium text-gray-600 border-b border-gray-200 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-2 text-gray-700 font-mono max-w-[200px] truncate"
                    title={String(row[col] ?? "")}
                  >
                    {row[col] === null ? (
                      <span className="text-gray-400 italic">null</span>
                    ) : (
                      String(row[col])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50">
          <span className="text-xs text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
