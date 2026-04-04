import { useState } from "react";
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
        focused ? "border-[#f59e0b]/25" : "border-[#3a3a55]"
      }`}
    >
      {isBusy && (
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
          <span className="text-[10px] font-mono text-[#f59e0b] tracking-wider">
            {isGenerating
              ? `writing ${generatePost.variables?.type}…`
              : "researching…"}
          </span>
        </div>
      )}

      <textarea
        className="w-full bg-transparent font-mono text-[13px] text-[#e8e8ed] placeholder-[#9090a0] resize-none focus:outline-none leading-relaxed tracking-wide"
        rows={4}
        placeholder="What's on your mind?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={isBusy}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus
      />

      <div className="flex items-center justify-between pt-3 mt-1 border-t border-[#3a3a55]">
        <span className="text-[10px] font-mono text-[#28283a] tabular-nums select-none">
          {text.length > 0 ? `${text.length}` : "·"}
        </span>
        <div className="flex gap-1.5">
          <ActionButton
            label={
              isGenerating && generatePost.variables?.type === "tweet"
                ? "writing…"
                : "tweet"
            }
            onClick={() => handleGeneratePost("tweet")}
            disabled={isBusy || !text.trim()}
            variant="primary"
          />
          <ActionButton
            label={
              isGenerating && generatePost.variables?.type === "thread"
                ? "writing…"
                : "thread"
            }
            onClick={() => handleGeneratePost("thread")}
            disabled={isBusy || !text.trim()}
            variant="secondary"
          />
          <ActionButton
            label={isResearching ? "thinking…" : "research"}
            onClick={handleResearch}
            disabled={isBusy || !text.trim()}
            variant="secondary"
          />
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  variant,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  variant: "primary" | "secondary";
}) {
  return (
    <button
      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-150 active:scale-95 disabled:opacity-25 ${
        variant === "primary"
          ? "bg-[#f59e0b] text-[#0b0b0e] hover:bg-[#fbbf24]"
          : "bg-[#2a2a42] text-[#c8c8e0] hover:bg-[#363658] hover:text-white"
      }`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
