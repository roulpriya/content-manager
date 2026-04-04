import { useState } from "react";
import { ArrowLeft, Check, Copy, RotateCcw } from "lucide-react";
import { trpc } from "../trpc";
import type { Post } from "@content-manager/server";

const STATUS: Record<Post["status"], { label: string; color: string }> = {
  idea:      { label: "Draft",     color: "#64748b" },
  generated: { label: "Generated", color: "#60a5fa" },
  approved:  { label: "Approved",  color: "#34d399" },
  posted:    { label: "Posted",    color: "#a78bfa" },
};

interface Props {
  postId: number;
  onBack: () => void;
}

export function OutputPanel({ postId, onBack }: Props) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState("");
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
    <div className="flex flex-col min-h-full p-6">
      {/* Nav */}
      <div className="flex items-center justify-between mb-8">
        <button
          className="inline-flex items-center gap-2 text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-wider"
          onClick={onBack}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          back
        </button>
        <div className="flex items-center gap-2">
          {post.status === "generated" && (
            <button
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-400/20 bg-emerald-950 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-900 disabled:opacity-50 transition-colors"
              onClick={() => updateStatus.mutate({ id: post.id, status: "approved" })}
              disabled={updateStatus.isPending}
            >
              <Check className="w-3.5 h-3.5" />
              approve
            </button>
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

      {/* Meta row */}
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
          {new Date(post.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      {/* Content */}
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

      {/* Regenerate */}
      <div className="border-t border-slate-700 pt-5">
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">
          regenerate
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-zinc-900 border border-slate-700 rounded-lg px-3 py-2 text-[13px] font-mono text-slate-200 placeholder-zinc-400 focus:outline-none focus:border-amber-500/30 transition-colors"
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
