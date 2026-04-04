import { useState } from "react";
import { trpc } from "../trpc";
import type { Post } from "@content-manager/server";

const STATUS: Record<Post["status"], { label: string; color: string }> = {
  idea:      { label: "Draft",     color: "#52526a" },
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
          className="text-[11px] font-mono text-[#8888aa] hover:text-[#e8e8ed] transition-colors uppercase tracking-wider"
          onClick={onBack}
        >
          ← back
        </button>
        <div className="flex items-center gap-2">
          {post.status === "generated" && (
            <button
              className="px-3 py-1.5 rounded-lg border border-[#34d399]/20 bg-[#0e2420] text-[11px] font-semibold text-[#34d399] hover:bg-[#112a24] disabled:opacity-50 transition-colors"
              onClick={() => updateStatus.mutate({ id: post.id, status: "approved" })}
              disabled={updateStatus.isPending}
            >
              approve
            </button>
          )}
          <button
            className="px-3 py-1.5 rounded-lg bg-[#1c1c26] text-[11px] font-semibold text-[#70708a] hover:text-[#e8e8ed] hover:bg-[#242432] transition-colors"
            onClick={handleCopy}
          >
            {copied ? "copied ✓" : "copy"}
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
        <span className="text-[#1c1c26]">·</span>
        <span className="text-[10px] font-mono text-[#32324a] capitalize">{post.type}</span>
        <span className="text-[#1c1c26]">·</span>
        <span className="text-[10px] font-mono text-[#28283a]">
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
          <h1 className="text-base font-semibold text-[#e8e8ed] mb-5 leading-snug">
            {post.title}
          </h1>
        )}
        <div className="flex flex-col gap-4">
          {lines.map((line, i) => (
            <p
              key={i}
              className="text-sm font-mono text-[#b8b8cc] leading-relaxed"
            >
              {line}
            </p>
          ))}
        </div>
      </div>

      {/* Regenerate */}
      <div className="border-t border-[#3a3a55] pt-5">
        <p className="text-[10px] font-mono text-[#28283a] uppercase tracking-widest mb-3">
          regenerate
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-[#111116] border border-[#3a3a55] rounded-lg px-3 py-2 text-[13px] font-mono text-[#e8e8ed] placeholder-[#9090a0] focus:outline-none focus:border-[#f59e0b]/30 transition-colors"
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
            className="px-4 py-2 rounded-lg bg-[#1c1c26] text-sm text-[#70708a] hover:text-[#e8e8ed] hover:bg-[#242432] disabled:opacity-50 transition-colors"
            onClick={() =>
              regenerate.mutate({ id: post.id, feedback: feedback || undefined })
            }
            disabled={regenerate.isPending}
          >
            {regenerate.isPending ? "…" : "↺"}
          </button>
        </div>
      </div>
    </div>
  );
}
