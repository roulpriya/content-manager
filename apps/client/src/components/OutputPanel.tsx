import { useRef, useState } from "react";
import { Check, Copy, LoaderCircle, RotateCcw, X } from "lucide-react";
import { trpc } from "../trpc";
import type { Post, PostTopic } from "@content-manager/server";

const STATUS: Record<Post["status"], { label: string; color: string }> = {
  idea:      { label: "Draft",     color: "#64748b" },
  generated: { label: "Generated", color: "#60a5fa" },
  accepted:  { label: "Accepted",  color: "#34d399" },
  published: { label: "Published", color: "#a78bfa" },
  rejected:  { label: "Archived",  color: "#f87171" },
};

const TOPIC_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "new-tech-stack", label: "New Tech Stack" },
  { value: "ui-product-demo",label: "UI / Product / Demo" },
  { value: "github-daily",   label: "GitHub Daily" },
];

interface Props {
  postId: number;
}

export function OutputPanel({ postId }: Props) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [topicSaved, setTopicSaved] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<Post["status"] | null>(null);
  const feedbackRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: posts = [] } = trpc.post.list.useQuery({});
  const post = posts.find((p) => p.id === postId);

  const regenerate = trpc.post.regenerate.useMutation({
    onSuccess: () => {
      setFeedback("");
      utils.post.list.invalidate();
    },
  });

  const updateStatus = trpc.post.updateStatus.useMutation({
    onSuccess: () => utils.post.list.invalidate(),
  });
  const updateTopic = trpc.post.updateTopic.useMutation({
    onSuccess: () => {
      utils.post.list.invalidate();
      setTopicSaved(true);
      setTimeout(() => setTopicSaved(false), 2000);
    },
  });

  function handleStatusUpdate(status: Post["status"]) {
    if (!post) return;
    setPendingStatus(status);
    updateStatus.mutate(
      { id: post.id, status },
      { onSettled: () => setPendingStatus(null) }
    );
  }

  async function handleCopy() {
    if (!post?.body) return;
    await navigator.clipboard.writeText(post.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!post) return null;

  const status = STATUS[post.status];
  const lines = post.body?.split("\n").filter(Boolean) ?? [];

  return (
    <div
      className="flex flex-col p-6"
      onKeyDown={(e) => {
        if (
          e.key === "r" && !e.metaKey && !e.ctrlKey &&
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA" &&
          document.activeElement?.tagName !== "SELECT"
        ) {
          e.preventDefault();
          feedbackRef.current?.focus();
        }
      }}
    >
      <div className="flex items-center justify-end mb-8">
        <div className="flex items-center gap-2">
          {post.status === "generated" && (
            <>
              <button
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-400/20 bg-emerald-950 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-900 disabled:opacity-50 transition-colors"
                onClick={() => handleStatusUpdate("accepted")}
                disabled={updateStatus.isPending}
              >
                {pendingStatus === "accepted"
                  ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                  : <Check className="w-3.5 h-3.5" />}
                accept
              </button>
              <button
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-400/20 bg-red-950 text-[11px] font-semibold text-red-400 hover:bg-red-900 disabled:opacity-50 transition-colors"
                onClick={() => handleStatusUpdate("rejected")}
                disabled={updateStatus.isPending}
              >
                {pendingStatus === "rejected"
                  ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                  : <X className="w-3.5 h-3.5" />}
                reject
              </button>
            </>
          )}
          {post.status === "accepted" && (
            <>
              <button
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-violet-400/20 bg-violet-950 text-[11px] font-semibold text-violet-300 hover:bg-violet-900 disabled:opacity-50 transition-colors"
                onClick={() => handleStatusUpdate("published")}
                disabled={updateStatus.isPending}
              >
                {pendingStatus === "published"
                  ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                  : <Check className="w-3.5 h-3.5" />}
                publish
              </button>
              <button
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-400/20 bg-red-950 text-[11px] font-semibold text-red-400 hover:bg-red-900 disabled:opacity-50 transition-colors"
                onClick={() => handleStatusUpdate("rejected")}
                disabled={updateStatus.isPending}
              >
                {pendingStatus === "rejected"
                  ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                  : <X className="w-3.5 h-3.5" />}
                archive
              </button>
            </>
          )}
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 text-[11px] font-semibold text-slate-400 hover:text-slate-200 hover:bg-zinc-800 transition-colors"
            onClick={handleCopy}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2.5 mb-6">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: status.color }}
        />
        <span
          className="text-[10px] font-mono uppercase tracking-widest"
          style={{ color: status.color }}
        >
          {status.label}
        </span>
        <span className="text-zinc-900">·</span>
        <span className="text-[10px] font-mono text-slate-500 capitalize">{post.type}</span>
        <span className="text-zinc-900">·</span>
        <span className="text-[10px] font-mono text-slate-500">
          {new Date(post.scheduledFor).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          topic
        </span>
        <select
          value={post.topic}
          onChange={(e) =>
            updateTopic.mutate({ id: post.id, topic: e.target.value as PostTopic })
          }
          disabled={updateTopic.isPending}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-[11px] font-medium text-slate-300 focus:outline-none"
        >
          {TOPIC_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {topicSaved && (
          <span className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase">
            saved
          </span>
        )}
      </div>

      <div className="flex-1 mb-10">
        {post.title && (
          <h1 className="text-base font-semibold text-slate-200 mb-5 leading-snug">
            {post.title}
          </h1>
        )}
        <div className="flex flex-col gap-4">
          {lines.map((line, i) => (
            <p
              key={i}
              className="text-sm font-mono text-slate-300 leading-relaxed"
            >
              {line}
            </p>
          ))}
        </div>
      </div>

      <div className="pt-6">
        <div className="flex items-center gap-3 mb-3">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            regenerate
          </p>
          <span className="text-[10px] font-mono text-slate-600">press r</span>
        </div>
        <div className="flex gap-2">
          <input
            ref={feedbackRef}
            type="text"
            className="flex-1 bg-zinc-900 rounded-lg px-3 py-2 text-[13px] font-mono text-slate-200 placeholder-zinc-400 focus:outline-none transition-colors"
            placeholder="feedback (optional)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !regenerate.isPending)
                regenerate.mutate({ id: post.id, feedback: feedback || undefined });
            }}
            disabled={regenerate.isPending}
          />
          <button
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-zinc-900 text-sm text-slate-400 hover:text-slate-200 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            onClick={() =>
              regenerate.mutate({ id: post.id, feedback: feedback || undefined })
            }
            disabled={regenerate.isPending}
            aria-label="Regenerate post"
          >
            <RotateCcw
              className={`w-4 h-4 ${regenerate.isPending ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
