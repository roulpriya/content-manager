import { useState } from "react";
import { Trash2 } from "lucide-react";
import { trpc } from "../trpc";
import type { Memory } from "@content-manager/server";

const STATUS_STYLE: Record<Memory["status"], { label: string; color: string }> = {
  idea:      { label: "Draft",     color: "#64748b" },
  generated: { label: "Generated", color: "#60a5fa" },
  accepted:  { label: "Accepted",  color: "#34d399" },
  published: { label: "Published", color: "#a78bfa" },
  rejected:  { label: "Archived",  color: "#f87171" },
};

const TOPIC_LABEL: Record<string, string> = {
  "new-tech-stack": "New Tech Stack",
  "ui-product-demo":"UI Demo",
  "github-daily":   "GitHub Daily",
};

export function MemoryPanel() {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: memories = [], isLoading } = trpc.memory.list.useQuery({});

  const deleteMemory = trpc.memory.delete.useMutation({
    onSuccess: () => utils.memory.list.invalidate(),
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
      </div>
    );
  }

  if (memories.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
        <p className="text-sm text-slate-400">No memories yet</p>
        <p className="text-xs text-slate-600">
          Memories are created when posts are generated or approved.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col divide-y divide-zinc-800/60">
      <div className="px-6 py-3 flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-500 tracking-widest uppercase">
          {memories.length} {memories.length === 1 ? "memory" : "memories"}
        </span>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {memories.map((memory) => {
          const status = STATUS_STYLE[memory.status];
          const date = new Date(memory.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });

          return (
            <li
              key={memory.id}
              className="relative px-6 py-4 hover:bg-zinc-800/40 transition-colors group"
              onMouseEnter={() => setHoveredId(memory.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider"
                      style={{ color: status.color }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full inline-block"
                        style={{ backgroundColor: status.color }}
                      />
                      {status.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
                      {memory.type}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
                      {TOPIC_LABEL[memory.topic] ?? memory.topic}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600 tracking-wider">
                      {date}
                    </span>
                  </div>

                  {memory.title && (
                    <p className="text-sm text-slate-200 font-medium leading-snug mb-1 truncate">
                      {memory.title}
                    </p>
                  )}

                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {memory.body}
                  </p>
                </div>

                <button
                  className={`shrink-0 p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-zinc-700/60 transition-all ${
                    hoveredId === memory.id ? "opacity-100" : "opacity-0"
                  }`}
                  onClick={() => deleteMemory.mutate({ id: memory.id })}
                  aria-label="Delete memory"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
