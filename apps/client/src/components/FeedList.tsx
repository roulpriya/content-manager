import { useState } from "react";
import { ArrowUpDown, CalendarDays, Trash2 } from "lucide-react";
import { trpc } from "../trpc";
import type { Post, Idea } from "@content-manager/server";

type Filter = "all" | "posts" | "ideas" | "archive";

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
      scheduledFor: number;
      topic: string;
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
  idea:      { label: "Draft",     color: "#64748b" },
  generated: { label: "Generated", color: "#60a5fa" },
  accepted:  { label: "Accepted",  color: "#34d399" },
  published: { label: "Published", color: "#a78bfa" },
  rejected:  { label: "Archived",  color: "#f87171" },
};

const IDEA_STATUS: Record<Idea["status"], { label: string; color: string }> = {
  pending:   { label: "Pending",     color: "#64748b" },
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
  const [sortByScheduled, setSortByScheduled] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
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

  const activePosts = posts.filter((p) => p.status !== "rejected");
  const archivedPosts = posts.filter((p) => p.status === "rejected");

  function buildPostItem(p: Post): FeedItem & { kind: "post" } {
    const s = POST_STATUS[p.status];
    return {
      kind: "post",
      id: p.id,
      label: p.title ?? p.input,
      sub: p.type === "tweet" ? "Tweet" : "Thread",
      status: p.status,
      statusLabel: s.label,
      statusColor: s.color,
      createdAt: p.createdAt,
      scheduledFor: p.scheduledFor,
      topic: topicLabel(p.topic),
    };
  }

  function buildIdeaItem(i: Idea): FeedItem & { kind: "idea" } {
    const s = IDEA_STATUS[i.status];
    return {
      kind: "idea",
      id: i.id,
      label: i.topic,
      status: i.status,
      statusLabel: s.label,
      statusColor: s.color,
      createdAt: i.createdAt,
      isPulsing: i.status === "enriching",
    };
  }

  const feed: FeedItem[] = (() => {
    let items: FeedItem[] = [];
    if (filter === "all") {
      items = [...activePosts.map(buildPostItem), ...ideas.map(buildIdeaItem)];
    } else if (filter === "posts") {
      items = activePosts.map(buildPostItem);
    } else if (filter === "ideas") {
      items = ideas.map(buildIdeaItem);
    } else if (filter === "archive") {
      items = archivedPosts.map(buildPostItem);
    }

    return items.sort((a, b) => {
      if (sortByScheduled && filter !== "ideas" && a.kind === "post" && b.kind === "post") {
        return a.scheduledFor - b.scheduledFor;
      }
      return b.createdAt - a.createdAt;
    });
  })();

  const counts: Record<Filter, number> = {
    all: activePosts.length + ideas.length,
    posts: activePosts.length,
    ideas: ideas.length,
    archive: archivedPosts.length,
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "posts", label: "Posts" },
    { key: "ideas", label: "Ideas" },
    { key: "archive", label: "Archive" },
  ];

  const canSortByScheduled = filter !== "ideas";

  return (
    <div className="flex flex-col">
      {/* Filter tabs + sort toggle */}
      <div className="flex shrink-0 items-center px-6 pt-3 pb-2 gap-1">
        <div className="flex-1 flex gap-1">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              className={`px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                filter === key
                  ? "text-amber-500 bg-amber-500/10"
                  : "text-slate-500 hover:text-slate-300"
              }`}
              onClick={() => setFilter(key)}
            >
              {label}
              {!isLoading && counts[key] > 0 && (
                <span className="ml-1.5 tabular-nums">{counts[key]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Sort toggle — only relevant when posts are visible */}
        {canSortByScheduled && (
          <button
            onClick={() => setSortByScheduled((v) => !v)}
            title={sortByScheduled ? "Sorted by scheduled date — click for recent" : "Sorted by recent — click for scheduled date"}
            className={`p-1.5 rounded-lg transition-colors ${
              sortByScheduled
                ? "text-amber-400 bg-amber-500/10"
                : "text-zinc-600 hover:text-slate-400"
            }`}
          >
            {sortByScheduled ? (
              <CalendarDays className="w-3.5 h-3.5" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Items */}
      <div className="pb-4">
        {isLoading && (
          <div className="flex items-center gap-2 px-8 py-6">
            <span className="w-1 h-1 rounded-full bg-slate-500 animate-pulse" />
            <span className="text-[10px] font-mono text-slate-500">loading</span>
          </div>
        )}

        {!isLoading && feed.length === 0 && (
          <div className="px-8 pt-14">
            <p className="text-sm font-mono text-slate-500">nothing here yet_</p>
          </div>
        )}

        {feed.map((item) => {
          const itemKey = `${item.kind}-${item.id}`;
          const isPendingDelete = pendingDeleteId === itemKey;

          return (
            <div
              key={itemKey}
              className="relative group flex items-start gap-4 px-6 py-4 cursor-pointer hover:bg-zinc-900/60 rounded-xl mx-2 transition-colors"
              onClick={() =>
                item.kind === "post" ? onSelectPost(item.id) : onSelectIdea(item.id)
              }
              onMouseLeave={() => {
                if (isPendingDelete) setPendingDeleteId(null);
              }}
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
                <p className="text-sm text-slate-200 font-medium leading-snug line-clamp-2">
                  {item.label}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wide">
                    {item.kind === "post" ? item.sub : "Research"}
                  </span>
                  <span className="text-zinc-700">·</span>
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: item.statusColor }}
                  >
                    {item.statusLabel}
                  </span>
                  {item.kind === "post" && (
                    <>
                      <span className="text-zinc-700">·</span>
                      <span className="text-[10px] font-mono text-slate-600">
                        {item.topic}
                      </span>
                    </>
                  )}
                  <span className="text-zinc-700">·</span>
                  <span className="text-[10px] font-mono text-slate-600">
                    {item.kind === "post" && sortByScheduled
                      ? formatScheduledDate(item.scheduledFor)
                      : formatDate(item.createdAt)}
                  </span>
                </div>
              </div>

              {/* Delete */}
              {isPendingDelete ? (
                <button
                  className="absolute top-4 right-4 flex items-center gap-1 text-red-400 opacity-0 group-hover:opacity-100 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    item.kind === "post"
                      ? deletePost.mutate({ id: item.id })
                      : deleteIdea.mutate({ id: item.id });
                    setPendingDeleteId(null);
                  }}
                  aria-label="Confirm delete"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-widest">
                    sure?
                  </span>
                </button>
              ) : (
                <button
                  className="absolute top-4 right-4 text-zinc-900 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDeleteId(itemKey);
                  }}
                  aria-label={`Delete ${item.kind}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
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

function formatScheduledDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function topicLabel(topic: string): string {
  return topic.replace(/-/g, " ");
}
