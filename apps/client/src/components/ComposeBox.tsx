import { useState } from "react";
import { FileText, Lightbulb, LoaderCircle, ScrollText } from "lucide-react";
import { trpc } from "../trpc";

interface Props {
  onPostCreated: (id: number) => void;
  onIdeaCreated: (id: number) => void;
}

export function ComposeBox({ onPostCreated, onIdeaCreated }: Props) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const utils = trpc.useUtils();

  const generatePost = trpc.post.generate.useMutation({
    onSuccess: (post) => {
      setText("");
      utils.post.list.invalidate();
      onPostCreated(post.id);
    },
  });

  const createIdea = trpc.idea.create.useMutation();
  const enrichIdea = trpc.idea.enrich.useMutation({
    onSuccess: () => utils.idea.list.invalidate(),
  });

  const isGenerating = generatePost.isPending;
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
    if (!text.trim() || isBusy) return;
    generatePost.mutate({ input: text.trim(), type });
  }

  return (
    <div
      className={`shrink-0 px-5 pt-5 pb-4 border-b transition-colors duration-300 ${
        focused ? "border-amber-500/25" : "border-slate-700"
      }`}
    >
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
        className="w-full bg-transparent font-mono text-[13px] text-slate-200 placeholder-zinc-400 resize-none focus:outline-none leading-relaxed tracking-wide"
        rows={4}
        placeholder="What's on your mind?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={isBusy}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus
      />

      <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-700">
        <span className="text-[10px] font-mono text-slate-500 tabular-nums select-none">
          {text.length > 0 ? `${text.length}` : "·"}
        </span>
        <div className="flex gap-1.5">
          <ActionButton
            icon={FileText}
            label={
              isGenerating && generatePost.variables?.type === "tweet"
                ? "writing…"
                : "tweet"
            }
            onClick={() => handleGeneratePost("tweet")}
            disabled={isBusy || !text.trim()}
            color="amber"
          />
          <ActionButton
            icon={ScrollText}
            label={
              isGenerating && generatePost.variables?.type === "thread"
                ? "writing…"
                : "thread"
            }
            onClick={() => handleGeneratePost("thread")}
            disabled={isBusy || !text.trim()}
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
  );
}

const BUTTON_COLORS = {
  amber: "bg-amber-500 text-zinc-950 hover:bg-amber-400",
  blue:  "bg-blue-400 text-zinc-950 hover:bg-blue-300",
  violet: "bg-violet-400 text-zinc-950 hover:bg-violet-300",
};

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
