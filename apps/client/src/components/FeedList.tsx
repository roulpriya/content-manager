import { useState } from "react";
import { trpc } from "../trpc";
import type { Post, Idea } from "@content-manager/server";

type Filter = "all" | "posts" | "ideas";

type FeedItem =
  | {
      kind: "post";
      id: number;
      label: string;
      sub: string;
      status: Post["status"];
      statusLabel: string;
      statusColor: string;
      createdAt: number;
    }
  | {
      kind: "idea";
      id: number;
      label: string;
      status: Idea["status"];
      statusLabel: string;
      statusColor: string;
      createdAt: number;
      isPulsing: boolean;
    };

const POST_STATUS: Record<Post["status"], { label: string; color: string }> = {
  idea:      { label: "Draft",     color: "#52526a" },
  generated: { label: "Generated", color: "#60a5fa" },
  approved:  { label: "Approved",  color: "#34d399" },
  posted:    { label: "Posted",    color: "#a78bfa" },
};

const IDEA_STATUS: Record<Idea["status"], { label: string; color: string }> = {
  pending:   { label: "Pending",     color: "#52526a" },
  enriching: { label: "Researching", color: "#f59e0b" },
  enriched:  { label: "Done",        color: "#34d399" },
  error:     { label: "Error",       color: "#f87171" },
};

interface Props {
  onSelectPost: (id: number) => void;
  onSelectIdea: (id: number) => void;
}

export function FeedList({ onSelectPost, onSelectIdea }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const utils = trpc.useUtils();

  const { data: posts = [], isLoading: postsLoading } = trpc.post.list.useQuery({});
  const { data: ideas = [], isLoading: ideasLoading } = trpc.idea.list.useQuery(undefined, {
    refetchInterval: (query) => {
      if (query.state.data?.some((i) => i.status === "enriching")) return 3000;
      return false;
    },
  });

  const deletePost = trpc.post.delete.useMutation({
    onSuccess: () => utils.post.list.invalidate(),
  });
  const deleteIdea = trpc.idea.delete.useMutation({
    onSuccess: () => utils.idea.list.invalidate(),
  });

  const isLoading = postsLoading || ideasLoading;

  const feed: FeedItem[] = [
    ...(filter !== "ideas"
      ? posts.map((p) => {
          const s = POST_STATUS[p.status];
          return {
            kind: "post" as const,
            id: p.id,
            label: p.title ?? p.input,
            sub: p.type === "tweet" ? "Tweet" : "Thread",
            status: p.status,
            statusLabel: s.label,
            statusColor: s.color,
            createdAt: p.createdAt,
          };
        })
      : []),
    ...(filter !== "posts"
      ? ideas.map((i) => {
          const s = IDEA_STATUS[i.status];
          return {
            kind: "idea" as const,
            id: i.id,
            label: i.topic,
            status: i.status,
            statusLabel: s.label,
            statusColor: s.color,
            createdAt: i.createdAt,
            isPulsing: i.status === "enriching",
          };
        })
      : []),
  ].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filter tabs */}
      <div className="flex shrink-0 border-b border-[#3a3a55] px-5">
        {(["all", "posts", "ideas"] as Filter[]).map((f) => (
          <button
            key={f}
            className={`py-2.5 mr-5 text-[10px] font-semibold uppercase tracking-widest transition-colors border-b-2 -mb-px ${
              filter === f
                ? "text-[#f59e0b] border-[#f59e0b]"
                : "text-[#8888aa] border-transparent hover:text-[#b8b8cc]"
            }`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center gap-2 p-5">
            <span className="w-1 h-1 rounded-full bg-[#28283a] animate-pulse" />
            <span className="text-[10px] font-mono text-[#28283a]">loading</span>
          </div>
        )}

        {!isLoading && feed.length === 0 && (
          <div className="p-5 pt-10">
            <p className="text-sm font-mono text-[#28283a]">nothing here yet_</p>
          </div>
        )}

        {feed.map((item) => (
          <div
            key={`${item.kind}-${item.id}`}
            className="relative group flex items-start gap-4 px-5 py-4 border-b border-[#121220] cursor-pointer hover:bg-[#0e0e18] transition-colors"
            onClick={() =>
              item.kind === "post" ? onSelectPost(item.id) : onSelectIdea(item.id)
            }
          >
            {/* Status dot */}
            <span
              className={`mt-[5px] w-1.5 h-1.5 rounded-full shrink-0 ${
                item.kind === "idea" && item.isPulsing ? "animate-pulse" : ""
              }`}
              style={{ backgroundColor: item.statusColor }}
            />

            {/* Content */}
            <div className="flex-1 min-w-0 pr-5">
              <p className="text-sm text-[#e8e8ed] font-medium leading-snug line-clamp-2">
                {item.label}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[10px] font-mono text-[#8888aa] uppercase tracking-wide">
                  {item.kind === "post" ? item.sub : "Research"}
                </span>
                <span className="text-[#4a4a68]">·</span>
                <span
                  className="text-[10px] font-mono"
                  style={{ color: item.statusColor }}
                >
                  {item.statusLabel}
                </span>
                <span className="text-[#4a4a68]">·</span>
                <span className="text-[10px] font-mono text-[#686888]">
                  {formatDate(item.createdAt)}
                </span>
              </div>
            </div>

            {/* Delete */}
            <button
              className="absolute top-4 right-4 text-[#1c1c26] hover:text-[#f87171] transition-colors opacity-0 group-hover:opacity-100 text-sm leading-none"
              onClick={(e) => {
                e.stopPropagation();
                item.kind === "post"
                  ? deletePost.mutate({ id: item.id })
                  : deleteIdea.mutate({ id: item.id });
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
