"use client";

import { useState } from "react";
import { Copy, Check, Code2 } from "lucide-react";

interface SqlPreviewProps {
  sql: string;
}

export function SqlPreview({ sql }: SqlPreviewProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700 bg-gray-900 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2 text-gray-400">
          <Code2 className="w-3.5 h-3.5" />
          <span className="text-xs font-medium uppercase tracking-wider">SQL</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-xs"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* SQL code */}
      <pre className="p-4 text-green-400 font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap">
        {sql}
      </pre>
    </div>
  );
}
