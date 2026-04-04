import { trpc } from "../trpc";
import type { Post } from "@content-manager/server";

const STATUS_BADGE: Record<Post["status"], { label: string; className: string }> = {
  idea: { label: "Idea", className: "bg-zinc-800 text-zinc-400" },
  generated: { label: "Generated", className: "bg-blue-950 text-blue-300" },
  approved: { label: "Approved", className: "bg-green-950 text-green-400" },
  posted: { label: "Posted", className: "bg-purple-950 text-purple-300" },
};

const TYPE_LABEL: Record<Post["type"], string> = {
  tweet: "Tweet",
  thread: "Thread",
};

interface Props {
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
}

export function PostList({ selectedId, onSelect, onNew }: Props) {
  const utils = trpc.useUtils();

  const { data: posts = [], isLoading } = trpc.post.list.useQuery({});

  const deleteMutation = trpc.post.delete.useMutation({
    onSuccess: () => utils.post.list.invalidate(),
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
          + New Post
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="p-4 text-xs text-zinc-600">Loading…</p>}
        {!isLoading && posts.length === 0 && (
          <p className="p-4 text-xs text-zinc-500">No posts yet. Generate your first one!</p>
        )}

        {[...posts].reverse().map((post) => {
          const badge = STATUS_BADGE[post.status];
          return (
            <div
              key={post.id}
              className={`group relative flex flex-col gap-1.5 px-3 py-4 cursor-pointer border-b border-zinc-800/50 transition-colors ${
                selectedId === post.id ? "bg-zinc-800" : "hover:bg-zinc-800/50"
              }`}
              onClick={() => onSelect(post.id)}
            >
              <p className="text-xs font-medium text-zinc-200 pr-5 leading-snug line-clamp-2">
                {post.title ?? post.input}
              </p>
              <div className="flex items-center gap-2">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-500">
                  {TYPE_LABEL[post.type]}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
                  {badge.label}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {new Date(post.createdAt).toLocaleDateString()}
                </span>
              </div>

              <button
                className="absolute top-4 right-2 flex items-center justify-center text-zinc-600 hover:text-red-400 active:text-red-400 transition-colors text-xs w-5 h-5"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMutation.mutate({ id: post.id });
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
