import { Plus, Trash2 } from "lucide-react";
import { trpc } from "../trpc";
import type { Idea } from "@content-manager/server";

const STATUS_BADGE: Record<Idea["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-zinc-800 text-zinc-400" },
  enriching: { label: "Researching…", className: "bg-blue-950 text-blue-300" },
  enriched: { label: "Done", className: "bg-green-950 text-green-400" },
  error: { label: "Error", className: "bg-red-950 text-red-400" },
};

interface Props {
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
}

export function IdeaList({ selectedId, onSelect, onNew }: Props) {
  const utils = trpc.useUtils();

  const { data: ideas = [], isLoading } = trpc.idea.list.useQuery(undefined, {
    refetchInterval: (query) => {
      if (query.state.data?.some((i) => i.status === "enriching")) return 3000;
      return false;
    },
  });

  const deleteMutation = trpc.idea.delete.useMutation({
    onSuccess: () => utils.idea.list.invalidate(),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-zinc-800">
        <button
          className={`w-full rounded-lg px-3 py-2 text-xs font-medium text-left transition-colors ${
            selectedId === null
              ? "bg-zinc-700 text-zinc-100"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
          }`}
          onClick={onNew}
        >
          <span className="inline-flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" />
            New Idea
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="p-4 text-xs text-zinc-600">Loading…</p>}
        {!isLoading && ideas.length === 0 && (
          <p className="p-4 text-xs text-zinc-500">No ideas yet. Add your first one!</p>
        )}

        {ideas.map((idea) => {
          const badge = STATUS_BADGE[idea.status];
          return (
            <div
              key={idea.id}
              className={`group relative flex flex-col gap-1.5 px-3 py-4 cursor-pointer border-b border-zinc-800/50 transition-colors ${
                selectedId === idea.id
                  ? "bg-zinc-800"
                  : "hover:bg-zinc-800/50"
              }`}
              onClick={() => onSelect(idea.id)}
            >
              <p className="text-xs font-medium text-zinc-200 pr-5 leading-snug line-clamp-2">
                {idea.topic}
              </p>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className} ${
                    idea.status === "enriching" ? "animate-pulse" : ""
                  }`}
                >
                  {badge.label}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {new Date(idea.createdAt).toLocaleDateString()}
                </span>
              </div>

              <button
                className="absolute top-4 right-2 flex items-center justify-center text-zinc-600 hover:text-red-400 active:text-red-400 transition-colors text-xs w-5 h-5"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMutation.mutate({ id: idea.id });
                }}
                aria-label="Delete idea"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
