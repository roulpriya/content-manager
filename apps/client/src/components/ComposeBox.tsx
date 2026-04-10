import { useState } from "react";
import { ChevronDown, FileText, Lightbulb, LoaderCircle, ScrollText } from "lucide-react";
import { trpc } from "../trpc";

interface Props {
  onPostCreated: (id: number) => void;
  onIdeaCreated: (id: number) => void;
}

export function ComposeBox({ onPostCreated, onIdeaCreated }: Props) {
  const [text, setText] = useState("");
  const [topicOption, setTopicOption] = useState(""); // known topic key or "custom"
  const [customTopic, setCustomTopic] = useState("");
  const [days, setDays] = useState(1);
  const utils = trpc.useUtils();

  const effectiveTopic = topicOption === "custom" ? customTopic.trim() : topicOption;
  const topicReady = effectiveTopic.length > 0;

  const generatePost = trpc.post.generate.useMutation({
    onSuccess: (post) => {
      setText("");
      setTopicOption("");
      setCustomTopic("");
      setDays(1);
      utils.post.list.invalidate();
      onPostCreated(post.id);
    },
  });
  const generateCalendar = trpc.post.generateCalendar.useMutation({
    onSuccess: (posts) => {
      setText("");
      setTopicOption("");
      setCustomTopic("");
      setDays(1);
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

  function handleGeneratePost(type: "tweet" | "thread") {
    if (!text.trim() || isBusy || !topicReady) return;
    if (days > 1) {
      generateCalendar.mutate({ input: text.trim(), type, topic: effectiveTopic, days });
      return;
    }
    generatePost.mutate({ input: text.trim(), type, topic: effectiveTopic });
  }

  return (
    <div className="shrink-0 px-6 pt-6 pb-7 border-b border-zinc-800">
      {isBusy && (
        <div className="flex items-center gap-2 mb-3">
          <LoaderCircle className="w-3.5 h-3.5 text-amber-500 animate-spin" />
          <span className="text-[10px] font-mono text-amber-500 tracking-wider">
            {isGenerating
              ? `writing ${generatePost.variables?.type}…`
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
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isBusy && text.trim() && topicReady) {
            e.preventDefault();
            handleGeneratePost("tweet");
          }
        }}
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
          <TopicSelect
            option={topicOption}
            onOptionChange={setTopicOption}
            custom={customTopic}
            onCustomChange={setCustomTopic}
            disabled={isBusy}
          />
          {!topicReady && text.trim().length > 0 && (
            <p className="text-[10px] font-mono text-amber-500 tracking-wide whitespace-nowrap">
              ↑ topic required
            </p>
          )}
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
            disabled={isBusy || !text.trim() || !topicReady}
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
            disabled={isBusy || !text.trim() || !topicReady}
            color="blue"
          />
          <ActionButton
            icon={Lightbulb}
            label={isResearching ? "thinking…" : "research"}
            onClick={handleResearch}
            disabled={isBusy || !text.trim()}
            color="violet"
          />
          </div>
        </div>
      </div>
    </div>
  );
}

const TOPIC_OPTIONS = [
  { value: "new-tech-stack", label: "New Tech Stack" },
  { value: "ui-product-demo",label: "UI / Product / Demo" },
  { value: "github-daily",   label: "GitHub Daily" },
];

const BUTTON_COLORS = {
  amber: "bg-amber-500 text-zinc-950 hover:bg-amber-400",
  blue:  "bg-blue-400 text-zinc-950 hover:bg-blue-300",
  violet: "bg-violet-400 text-zinc-950 hover:bg-violet-300",
};

function TopicSelect({
  option,
  onOptionChange,
  custom,
  onCustomChange,
  disabled,
}: {
  option: string;
  onOptionChange: (value: string) => void;
  custom: string;
  onCustomChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-52">
      <div className="relative">
        <select
          className="w-full appearance-none rounded-lg bg-zinc-900 px-3 py-2 pr-9 text-[11px] font-medium text-slate-300 focus:outline-none disabled:text-zinc-500"
          value={option}
          onChange={(e) => onOptionChange(e.target.value)}
          disabled={disabled}
          aria-label="Choose post topic"
        >
          <option value="">Choose topic</option>
          {TOPIC_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
          <option value="custom">Custom…</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
      </div>
      {option === "custom" && (
        <input
          type="text"
          className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-[11px] font-medium text-slate-300 placeholder-zinc-500 focus:outline-none disabled:text-zinc-500"
          placeholder="e.g. system design, finance, cooking"
          value={custom}
          onChange={(e) => onCustomChange(e.target.value)}
          disabled={disabled}
          autoFocus
        />
      )}
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
