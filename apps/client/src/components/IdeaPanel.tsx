import { trpc } from "../trpc";
import type { EnrichedContent } from "@content-manager/server";

interface Props {
  ideaId: number;
  onBack: () => void;
}

export function IdeaPanel({ ideaId, onBack }: Props) {
  const utils = trpc.useUtils();

  const { data: ideas = [] } = trpc.idea.list.useQuery();
  const idea = ideas.find((i) => i.id === ideaId);

  const enrichMutation = trpc.idea.enrich.useMutation({
    onSuccess: () => utils.idea.list.invalidate(),
  });

  if (!idea) return null;

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
        <span className="text-[10px] font-mono text-[#28283a]">
          {new Date(idea.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      {/* Topic */}
      <div className="mb-7">
        <p className="text-[10px] font-mono uppercase tracking-widest text-[#f59e0b] mb-2">
          Research
        </p>
        <h1 className="text-base font-semibold text-[#e8e8ed] leading-snug">{idea.topic}</h1>
        {idea.notes && (
          <p className="mt-2 text-sm text-[#52526a] leading-relaxed">{idea.notes}</p>
        )}
      </div>

      {/* States */}
      {idea.status === "pending" && (
        <div className="rounded-xl border border-[#3a3a55] bg-[#111116] p-5 flex flex-col gap-4">
          <p className="text-sm text-[#52526a]">No research yet.</p>
          <button
            className="self-start px-4 py-2 rounded-lg bg-[#f59e0b] text-[11px] font-semibold text-[#0b0b0e] hover:bg-[#fbbf24] disabled:opacity-50 transition-colors"
            onClick={() => enrichMutation.mutate({ id: idea.id })}
            disabled={enrichMutation.isPending}
          >
            {enrichMutation.isPending ? "starting…" : "start research"}
          </button>
        </div>
      )}

      {idea.status === "enriching" && (
        <div className="rounded-xl border border-[#f59e0b]/15 bg-[#181208] p-5">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse shrink-0" />
            <p className="text-sm text-[#f59e0b]">Searching the web…</p>
          </div>
          <p className="mt-2 text-[11px] font-mono text-[#3a2e10] ml-5">
            usually takes 10–20s
          </p>
        </div>
      )}

      {idea.status === "error" && (
        <div className="rounded-xl border border-[#f87171]/15 bg-[#18080a] p-5 flex flex-col gap-3">
          <p className="text-sm text-[#f87171]">
            {idea.errorMessage ?? "Research failed."}
          </p>
          <button
            className="self-start px-3 py-1.5 rounded-lg bg-[#1c1c26] text-[11px] font-semibold text-[#70708a] hover:text-[#e8e8ed] hover:bg-[#242432] transition-colors"
            onClick={() => enrichMutation.mutate({ id: idea.id })}
            disabled={enrichMutation.isPending}
          >
            retry
          </button>
        </div>
      )}

      {idea.status === "enriched" && idea.enrichedContent && (
        <EnrichedView
          content={JSON.parse(idea.enrichedContent) as EnrichedContent}
        />
      )}
    </div>
  );
}

function EnrichedView({ content }: { content: EnrichedContent }) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <SectionLabel>Summary</SectionLabel>
        <p className="text-sm text-[#b8b8cc] leading-relaxed">{content.summary}</p>
      </div>

      {content.keyFacts.length > 0 && (
        <div>
          <SectionLabel>Key Facts</SectionLabel>
          <div className="flex flex-col gap-3">
            {content.keyFacts.map((fact, i) => (
              <div key={i} className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-md bg-[#111116] border border-[#3a3a55] text-[10px] font-mono text-[#52526a] flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sm text-[#b8b8cc] leading-relaxed">{fact}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.links.length > 0 && (
        <div>
          <SectionLabel>Sources</SectionLabel>
          <div className="flex flex-col gap-2">
            {content.links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-xl border border-[#3a3a55] bg-[#0e0e16] p-4 hover:border-[#2a2a3a] hover:bg-[#111116] transition-colors"
              >
                <p className="text-sm font-medium text-[#60a5fa] group-hover:text-[#93c5fd] transition-colors leading-snug">
                  {link.title}
                </p>
                {link.snippet && (
                  <p className="mt-1.5 text-xs text-[#32324a] line-clamp-2 leading-relaxed">
                    {link.snippet}
                  </p>
                )}
                <p className="mt-2 text-[10px] font-mono text-[#28283a] truncate">
                  {link.url}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono font-semibold text-[#28283a] uppercase tracking-widest mb-4">
      {children}
    </p>
  );
}
