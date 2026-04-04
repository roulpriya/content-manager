import { ArrowLeft, ExternalLink, LoaderCircle, RotateCcw, Search } from "lucide-react";
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
          className="inline-flex items-center gap-2 text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-wider"
          onClick={onBack}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          back
        </button>
        <span className="text-[10px] font-mono text-slate-500">
          {new Date(idea.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      {/* Topic */}
      <div className="mb-7">
        <p className="text-[10px] font-mono uppercase tracking-widest text-amber-500 mb-2">
          Research
        </p>
        <h1 className="text-base font-semibold text-slate-200 leading-snug">{idea.topic}</h1>
        {idea.notes && (
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">{idea.notes}</p>
        )}
      </div>

      {/* States */}
      {idea.status === "pending" && (
        <div className="rounded-xl border border-slate-700 bg-zinc-900 p-5 flex flex-col gap-4">
          <p className="text-sm text-slate-500">No research yet.</p>
          <button
            className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-[11px] font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50 transition-colors"
            onClick={() => enrichMutation.mutate({ id: idea.id })}
            disabled={enrichMutation.isPending}
          >
            <Search className="w-3.5 h-3.5" />
            {enrichMutation.isPending ? "starting…" : "start research"}
          </button>
        </div>
      )}

      {idea.status === "enriching" && (
        <div className="rounded-xl border border-amber-500/15 bg-zinc-900 p-5">
          <div className="flex items-center gap-3">
            <LoaderCircle className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
            <p className="text-sm text-amber-500">Searching the web…</p>
          </div>
          <p className="mt-2 text-[11px] font-mono text-amber-600 ml-5">
            usually takes 10–20s
          </p>
        </div>
      )}

      {idea.status === "error" && (
        <div className="rounded-xl border border-red-400/15 bg-zinc-900 p-5 flex flex-col gap-3">
          <p className="text-sm text-red-400">
            {idea.errorMessage ?? "Research failed."}
          </p>
          <button
            className="self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 text-[11px] font-semibold text-slate-400 hover:text-slate-200 hover:bg-zinc-800 transition-colors"
            onClick={() => enrichMutation.mutate({ id: idea.id })}
            disabled={enrichMutation.isPending}
          >
            <RotateCcw className="w-3.5 h-3.5" />
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
        <p className="text-sm text-slate-300 leading-relaxed">{content.summary}</p>
      </div>

      {content.keyFacts.length > 0 && (
        <div>
          <SectionLabel>Key Facts</SectionLabel>
          <div className="flex flex-col gap-3">
            {content.keyFacts.map((fact, i) => (
              <div key={i} className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-md bg-zinc-900 border border-slate-700 text-[10px] font-mono text-slate-500 flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sm text-slate-300 leading-relaxed">{fact}</p>
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
                className="group block rounded-xl border border-slate-700 bg-zinc-950 p-4 hover:border-slate-800 hover:bg-zinc-900 transition-colors"
              >
                <p className="text-sm font-medium text-blue-400 group-hover:text-blue-300 transition-colors leading-snug">
                  {link.title}
                </p>
                {link.snippet && (
                  <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {link.snippet}
                  </p>
                )}
                <p className="mt-2 text-[10px] font-mono text-slate-500 truncate">
                  {link.url}
                </p>
                <ExternalLink className="mt-3 w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
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
    <p className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-widest mb-4">
      {children}
    </p>
  );
}
