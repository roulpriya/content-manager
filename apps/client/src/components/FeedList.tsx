import { useState } from "react";
import { Trash2 } from "lucide-react";
import { trpc } from "../trpc";
import type { Post, Idea, Article } from "@content-manager/server";

type Filter = "all" | "posts" | "calendar" | "ideas" | "articles" | "archive";

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
    }
  | {
      kind: "article";
      id: number;
      label: string;
      status: Article["status"];
      statusLabel: string;
      statusColor: string;
      createdAt: number;
      wordCount: number | null;
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

const ARTICLE_STATUS: Record<Article["status"], { label: string; color: string }> = {
  researching: { label: "Researching", color: "#f59e0b" },
  writing:     { label: "Writing",     color: "#60a5fa" },
  done:        { label: "Done",        color: "#10b981" },
  error:       { label: "Error",       color: "#f87171" },
};

interface Props {
  onSelectPost: (id: number) => void;
  onSelectIdea: (id: number) => void;
  onSelectArticle: (id: number) => void;
}

export function FeedList({ onSelectPost, onSelectIdea, onSelectArticle }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const utils = trpc.useUtils();

  const { data: posts = [], isLoading: postsLoading } = trpc.post.list.useQuery({});
  const { data: ideas = [], isLoading: ideasLoading } = trpc.idea.list.useQuery(undefined, {
    refetchInterval: (query) => {
      if (query.state.data?.some((i) => i.status === "enriching")) return 3000;
      return false;
    },
  });
  const { data: articles = [], isLoading: articlesLoading } = trpc.article.list.useQuery(undefined, {
    refetchInterval: (query) => {
      if (query.state.data?.some((a) => a.status === "researching" || a.status === "writing")) return 2000;
      return false;
    },
  });

  const deletePost = trpc.post.delete.useMutation({
    onSuccess: () => utils.post.list.invalidate(),
  });
  const deleteIdea = trpc.idea.delete.useMutation({
    onSuccess: () => utils.idea.list.invalidate(),
  });
  const deleteArticle = trpc.article.delete.useMutation({
    onSuccess: () => utils.article.list.invalidate(),
  });

  const isLoading = postsLoading || ideasLoading || articlesLoading;

  const visiblePosts = posts.filter((post) => {
    if (filter === "archive") return post.status === "rejected";
    if (filter === "calendar") return post.status !== "rejected";
    return post.status !== "rejected";
  });

  const feed: FeedItem[] = [
    ...(filter !== "ideas" && filter !== "articles" && filter !== "archive"
      ? visiblePosts.map((p) => {
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
            scheduledFor: p.scheduledFor,
            topic: topicLabel(p.topic),
          };
        })
      : []),
    ...(filter === "archive"
      ? posts
          .filter((p) => p.status === "rejected")
          .map((p) => {
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
              scheduledFor: p.scheduledFor,
              topic: topicLabel(p.topic),
            };
          })
      : []),
    ...(filter !== "posts" && filter !== "calendar" && filter !== "articles" && filter !== "archive"
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
    ...(filter !== "posts" && filter !== "calendar" && filter !== "ideas" && filter !== "archive"
      ? articles.map((a) => {
          const s = ARTICLE_STATUS[a.status];
          return {
            kind: "article" as const,
            id: a.id,
            label: a.title ?? a.topic,
            status: a.status,
            statusLabel: s.label,
            statusColor: s.color,
            createdAt: a.createdAt,
            wordCount: a.wordCount,
            isPulsing: a.status === "researching" || a.status === "writing",
          };
        })
      : []),
  ].sort((a, b) =>
    filter === "calendar" && a.kind === "post" && b.kind === "post"
      ? a.scheduledFor - b.scheduledFor
      : b.createdAt - a.createdAt
  );

  return (
    <div className="flex flex-col">
      {/* Filter tabs */}
      <div className="flex shrink-0 px-6 pt-3 pb-2 gap-1">
        {(["all", "posts", "calendar", "ideas", "articles", "archive"] as Filter[]).map((f) => (
          <button
            key={f}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-widest transition-all duration-150 ${
              filter === f
                ? "text-amber-400 bg-amber-500/12 border border-amber-500/20"
                : "text-zinc-500 hover:text-slate-300 border border-transparent"
            }`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="pb-4">
        {isLoading && (
          <div className="flex items-center gap-2 px-8 py-6">
            <span className="w-1 h-1 rounded-full bg-slate-500 animate-pulse" />
            <span className="text-[10px] text-slate-500">loading</span>
          </div>
        )}

        {!isLoading && feed.length === 0 && (
          <div className="px-8 pt-14">
            <p className="text-sm text-slate-500">nothing here yet_</p>
          </div>
        )}

        {feed.map((item) => {
          const accentColor =
            item.kind === "idea"
              ? "#a78bfa"
              : item.kind === "article"
                ? "#10b981"
                : item.sub === "Thread"
                  ? "#60a5fa"
                  : "#f59e0b";

          return (
            <div
              key={`${item.kind}-${item.id}`}
              className="relative group flex items-stretch gap-0 mx-2 cursor-pointer rounded-xl hover:bg-zinc-900/50 transition-colors overflow-hidden"
              onClick={() => {
                if (item.kind === "post") onSelectPost(item.id);
                else if (item.kind === "idea") onSelectIdea(item.id);
                else onSelectArticle(item.id);
              }}
            >
              {/* Left accent bar */}
              <div
                className="shrink-0 w-[3px] rounded-l-xl transition-opacity opacity-40 group-hover:opacity-80"
                style={{ backgroundColor: accentColor }}
              />

              {/* Content */}
              <div className="flex-1 min-w-0 flex items-start gap-3 px-4 py-3.5 pr-10">
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] text-slate-200 font-medium leading-snug line-clamp-2 tracking-tight">
                    {item.label}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span
                      className="text-[10px] uppercase tracking-wide font-semibold"
                      style={{ color: accentColor }}
                    >
                      {item.kind === "post" ? item.sub : item.kind === "idea" ? "Research" : "Article"}
                    </span>
                    <span className="text-zinc-700">·</span>
                    <span
                      className="text-[10px]"
                      style={{ color: item.statusColor }}
                    >
                      {item.statusLabel}
                    </span>
                    {item.kind === "post" && (
                      <>
                        <span className="text-zinc-700">·</span>
                        <span className="text-[10px] text-slate-500">
                          {item.topic}
                        </span>
                      </>
                    )}
                    {item.kind === "article" && item.wordCount && (
                      <>
                        <span className="text-zinc-700">·</span>
                        <span className="text-[10px] text-slate-500">
                          {item.wordCount.toLocaleString()} words
                        </span>
                      </>
                    )}
                    <span className="text-zinc-700">·</span>
                    <span className="text-[10px] text-slate-600">
                      {item.kind === "post" && filter === "calendar"
                        ? formatScheduledDate(item.scheduledFor)
                        : formatDate(item.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Delete */}
              <button
                className="absolute top-3.5 right-3 text-zinc-800 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.kind === "post") deletePost.mutate({ id: item.id });
                  else if (item.kind === "idea") deleteIdea.mutate({ id: item.id });
                  else deleteArticle.mutate({ id: item.id });
                }}
                aria-label={`Delete ${item.kind}`}
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
