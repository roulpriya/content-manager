import { useState } from "react";
import { FileText, Lightbulb, Minus, Plus, ScrollText, LoaderCircle } from "lucide-react";
import { trpc } from "../trpc";

interface Props {
  onPostCreated: (id: number) => void;
  onIdeaCreated: (id: number) => void;
}

const TOPIC_OPTIONS = [
  { value: "new-tech-stack", label: "Tech Stack" },
  { value: "ui-product-demo", label: "UI / Demo" },
  { value: "github-daily", label: "GitHub" },
];

export function ComposeBox({ onPostCreated, onIdeaCreated }: Props) {
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [days, setDays] = useState(1);
  const utils = trpc.useUtils();

  const effectiveTopic = topic === "custom" ? customTopic.trim() : topic;
  const topicReady = effectiveTopic.length > 0;

  const generatePost = trpc.post.generate.useMutation({
    onSuccess: (post) => {
      setText(""); setTopic(""); setCustomTopic(""); setDays(1);
      utils.post.list.invalidate();
      onPostCreated(post.id);
    },
  });

  const generateCalendar = trpc.post.generateCalendar.useMutation({
    onSuccess: (posts) => {
      setText(""); setTopic(""); setCustomTopic(""); setDays(1);
      utils.post.list.invalidate();
      if (posts[0]) onPostCreated(posts[0].id);
    },
  });

  const createIdea = trpc.idea.create.useMutation();
  const enrichIdea = trpc.idea.enrich.useMutation({
    onSuccess: () => utils.idea.list.invalidate(),
  });

  const isGenerating = generatePost.isPending || generateCalendar.isPending;
  const isResearching = createIdea.isPending || enrichIdea.isPending;
  const isBusy = isGenerating || isResearching;

  async function handleResearch() {
    if (!text.trim() || isBusy) return;
    const idea = await createIdea.mutateAsync({ topic: text.trim() });
    await enrichIdea.mutateAsync({ id: idea.id });
    setText("");
    utils.idea.list.invalidate();
    onIdeaCreated(idea.id);
  }

  function handleGenerate(type: "tweet" | "thread") {
    if (!text.trim() || isBusy || !topicReady) return;
    if (days > 1) {
      generateCalendar.mutate({ input: text.trim(), type, topic: effectiveTopic, days });
      return;
    }
    generatePost.mutate({ input: text.trim(), type, topic: effectiveTopic });
  }

  function toggleTopic(value: string) {
    setTopic((prev) => (prev === value ? "" : value));
  }

  return (
    <div className="shrink-0 px-6 pt-5 pb-5 border-b border-zinc-800">
      {/* Topic chips */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mr-0.5">
          topic
        </span>
        {TOPIC_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => toggleTopic(opt.value)}
            disabled={isBusy}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide transition-colors ${
              topic === opt.value
                ? "bg-amber-500 text-zinc-950"
                : "bg-zinc-800 text-slate-400 hover:text-slate-200 hover:bg-zinc-700"
            } disabled:opacity-40`}
          >
            {opt.label}
          </button>
        ))}
        <button
          onClick={() => toggleTopic("custom")}
          disabled={isBusy}
          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide transition-colors ${
            topic === "custom"
              ? "bg-amber-500 text-zinc-950"
              : "bg-zinc-800 text-slate-400 hover:text-slate-200 hover:bg-zinc-700"
          } disabled:opacity-40`}
        >
          custom
        </button>
        {topic === "custom" && (
          <input
            type="text"
            autoFocus
            className="rounded-full bg-zinc-800 px-3 py-1 text-[10px] font-medium text-slate-200 placeholder-zinc-500 focus:outline-none w-44"
            placeholder="e.g. system design, cooking…"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            disabled={isBusy}
          />
        )}
      </div>

      {/* Textarea */}
      <textarea
        className="w-full bg-zinc-900 rounded-xl px-4 py-3 font-mono text-[13px] text-slate-200 placeholder-zinc-500 resize-none focus:outline-none leading-relaxed tracking-wide"
        rows={4}
        placeholder="What's on your mind?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (
            (e.metaKey || e.ctrlKey) &&
            e.key === "Enter" &&
            !isBusy &&
            text.trim() &&
            topicReady
          ) {
            e.preventDefault();
            handleGenerate("tweet");
          }
        }}
        disabled={isBusy}
        autoFocus
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 pt-3">
        {/* Left: char count + busy indicator */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] font-mono text-zinc-600 tabular-nums select-none w-5 shrink-0">
            {text.length > 0 ? text.length : "·"}
          </span>
          {isBusy && (
            <div className="flex items-center gap-1.5">
              <LoaderCircle className="w-3 h-3 text-amber-500 animate-spin shrink-0" />
              <span className="text-[10px] font-mono text-amber-500 tracking-wider truncate">
                {isGenerating ? "writing…" : "researching…"}
              </span>
            </div>
          )}
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Days stepper */}
          <div className="flex items-center gap-1 bg-zinc-900 rounded-lg px-2 py-1.5">
            <button
              onClick={() => setDays((d) => Math.max(1, d - 1))}
              disabled={isBusy || days <= 1}
              className="text-zinc-500 hover:text-slate-300 disabled:text-zinc-700 transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-400 tabular-nums w-6 text-center select-none">
              {days}d
            </span>
            <button
              onClick={() => setDays((d) => Math.min(30, d + 1))}
              disabled={isBusy || days >= 30}
              className="text-zinc-500 hover:text-slate-300 disabled:text-zinc-700 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <span className="w-px h-4 bg-zinc-800" />

          {/* Research — no topic required */}
          <button
            onClick={handleResearch}
            disabled={isBusy || !text.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 disabled:bg-zinc-800 disabled:text-zinc-500 transition-all active:scale-95"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            {isResearching ? "thinking…" : "research"}
          </button>

          <span className="w-px h-4 bg-zinc-800" />

          {/* Generate tweet */}
          <button
            onClick={() => handleGenerate("tweet")}
            disabled={isBusy || !text.trim() || !topicReady}
            title={!topicReady && text.trim() ? "Pick a topic above to generate" : undefined}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 transition-all active:scale-95"
          >
            <FileText className="w-3.5 h-3.5" />
            {isGenerating && generatePost.variables?.type === "tweet"
              ? "writing…"
              : days > 1
                ? `tweet ×${days}`
                : "tweet"}
          </button>

          {/* Generate thread */}
          <button
            onClick={() => handleGenerate("thread")}
            disabled={isBusy || !text.trim() || !topicReady}
            title={!topicReady && text.trim() ? "Pick a topic above to generate" : undefined}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide bg-blue-400 text-zinc-950 hover:bg-blue-300 disabled:bg-zinc-800 disabled:text-zinc-500 transition-all active:scale-95"
          >
            <ScrollText className="w-3.5 h-3.5" />
            {isGenerating && generatePost.variables?.type === "thread"
              ? "writing…"
              : days > 1
                ? `thread ×${days}`
                : "thread"}
          </button>
        </div>
      </div>

      {/* Topic-required hint */}
      {!topicReady && text.trim() && !isBusy && (
        <p className="text-[10px] font-mono text-amber-600/60 tracking-wide mt-2 text-right">
          pick a topic above to generate
        </p>
      )}
    </div>
  );
}
