import { useState } from "react";
import { ChevronDown, FileText, Lightbulb, LoaderCircle, NotebookPen, ScrollText } from "lucide-react";
import type { PostTopic } from "@content-manager/server";
import { trpc } from "../trpc";

interface Props {
  onPostCreated: (id: number) => void;
  onIdeaCreated: (id: number) => void;
  onArticleCreated: (id: number) => void;
}

export function ComposeBox({ onPostCreated, onIdeaCreated, onArticleCreated }: Props) {
  const [text, setText] = useState("");
  const [topic, setTopic] = useState<PostTopic | "">("");
  const [days, setDays] = useState(1);
  const utils = trpc.useUtils();

  const generatePost = trpc.post.generate.useMutation({
    onSuccess: (post) => {
      setText("");
      setTopic("");
      setDays(1);
      utils.post.list.invalidate();
      onPostCreated(post.id);
    },
  });
  const generateCalendar = trpc.post.generateCalendar.useMutation({
    onSuccess: (posts) => {
      setText("");
      setTopic("");
      setDays(1);
      utils.post.list.invalidate();
      if (posts[0]) onPostCreated(posts[0].id);
    },
  });

  const createIdea = trpc.idea.create.useMutation();
  const enrichIdea = trpc.idea.enrich.useMutation({
    onSuccess: () => utils.idea.list.invalidate(),
  });

  const generateArticle = trpc.article.generate.useMutation({
    onSuccess: (article) => {
      setText("");
      utils.article.list.invalidate();
      onArticleCreated(article.id);
    },
  });

  const isGenerating = generatePost.isPending || generateCalendar.isPending;
  const isResearching = createIdea.isPending || enrichIdea.isPending;
  const isWritingArticle = generateArticle.isPending;
  const isBusy = isGenerating || isResearching || isWritingArticle;

  async function handleResearch() {
    if (!text.trim() || isBusy) return;
    const idea = await createIdea.mutateAsync({ topic: text.trim() });
    await enrichIdea.mutateAsync({ id: idea.id });
    setText("");
    utils.idea.list.invalidate();
    onIdeaCreated(idea.id);
  }

  function handleGenerateArticle() {
    if (!text.trim() || isBusy) return;
    generateArticle.mutate({ topic: text.trim() });
  }

  function handleGeneratePost(type: "tweet" | "thread") {
    if (!text.trim() || isBusy || !topic) return;
    if (days > 1) {
      generateCalendar.mutate({ input: text.trim(), type, topic, days });
      return;
    }
    generatePost.mutate({ input: text.trim(), type, topic });
  }

  return (
    <div className="shrink-0 px-6 pt-6 pb-7 border-b border-zinc-800">
      {isBusy && (
        <div className="flex items-center gap-2 mb-3">
          <LoaderCircle className="w-3.5 h-3.5 text-amber-500 animate-spin" />
          <span className="text-[10px] font-mono text-amber-500 tracking-wider">
            {isGenerating
              ? `writing ${generatePost.variables?.type}…`
              : isWritingArticle
              ? "starting article…"
              : "researching…"}
          </span>
        </div>
      )}

      <textarea
        className="w-full bg-zinc-900 rounded-xl px-4 py-3 font-mono text-[13px] text-slate-200 placeholder-zinc-400 resize-none focus:outline-none leading-relaxed tracking-wide"
        rows={4}
        placeholder="What's on your mind?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={isBusy}
        autoFocus
      />

      <div className="flex items-center justify-between gap-4 pt-4 mt-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-slate-500 tabular-nums select-none">
            {text.length > 0 ? `${text.length}` : "·"}
          </span>
          <DaysInput value={days} onChange={setDays} disabled={isBusy} />
        </div>
        <div className="flex items-center gap-2">
          <TopicSelect value={topic} onChange={setTopic} disabled={isBusy} />
          <div className="flex gap-1.5">
          <ActionButton
            icon={FileText}
            label={
              isGenerating && generatePost.variables?.type === "tweet"
                ? "writing…"
                : days > 1
                  ? `tweet x${days}`
                  : "tweet"
            }
            onClick={() => handleGeneratePost("tweet")}
            disabled={isBusy || !text.trim() || !topic}
            color="amber"
          />
          <ActionButton
            icon={ScrollText}
            label={
              isGenerating && generatePost.variables?.type === "thread"
                ? "writing…"
                : days > 1
                  ? `thread x${days}`
                  : "thread"
            }
            onClick={() => handleGeneratePost("thread")}
            disabled={isBusy || !text.trim() || !topic}
            color="blue"
          />
          <ActionButton
            icon={Lightbulb}
            label={isResearching ? "thinking…" : "research"}
            onClick={handleResearch}
            disabled={isBusy || !text.trim()}
            color="violet"
          />
          <ActionButton
            icon={NotebookPen}
            label={isWritingArticle ? "queuing…" : "article"}
            onClick={handleGenerateArticle}
            disabled={isBusy || !text.trim()}
            color="emerald"
          />
          </div>
        </div>
      </div>
    </div>
  );
}

const TOPIC_OPTIONS: Array<{ value: PostTopic; label: string }> = [
  { value: "day-schedule", label: "Day Schedule" },
  { value: "gym-routine", label: "Gym Routine" },
  { value: "llm-project", label: "LLM Project" },
  { value: "new-tech-stack", label: "New Tech Stack" },
  { value: "ui-product-demo", label: "UI / Product / Demo" },
];

const BUTTON_COLORS = {
  amber: "bg-amber-500 text-zinc-950 hover:bg-amber-400",
  blue:  "bg-blue-400 text-zinc-950 hover:bg-blue-300",
  violet: "bg-violet-400 text-zinc-950 hover:bg-violet-300",
  emerald: "bg-emerald-500 text-zinc-950 hover:bg-emerald-400",
};

function TopicSelect({
  value,
  onChange,
  disabled,
}: {
  value: PostTopic | "";
  onChange: (value: PostTopic | "") => void;
  disabled: boolean;
}) {
  return (
    <div className="relative min-w-52">
      <select
        className="w-full appearance-none rounded-lg bg-zinc-900 px-3 py-2 pr-9 text-[11px] font-medium text-slate-300 focus:outline-none disabled:text-zinc-500"
        value={value}
        onChange={(e) => onChange(e.target.value as PostTopic | "")}
        disabled={disabled}
        aria-label="Choose post topic"
      >
        <option value="">Choose topic</option>
        {TOPIC_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

function DaysInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
      days
      <input
        type="number"
        min={1}
        max={30}
        value={value}
        onChange={(e) => onChange(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
        disabled={disabled}
        className="w-14 rounded-lg bg-zinc-900 px-2 py-1 text-center text-[11px] text-slate-300 focus:outline-none"
      />
    </label>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  color,
  icon: Icon,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  color: keyof typeof BUTTON_COLORS;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide ${BUTTON_COLORS[color]} disabled:bg-zinc-800 disabled:text-zinc-500 transition-all duration-150 active:scale-95`}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
