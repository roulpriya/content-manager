import { useState } from "react";
import { ExternalLink, FileText, LoaderCircle, RotateCcw, ScrollText, Search } from "lucide-react";
import { trpc } from "../trpc";
import type { EnrichedContent } from "@content-manager/server";

const TOPIC_OPTIONS = [
  { value: "new-tech-stack", label: "Tech Stack" },
  { value: "ui-product-demo", label: "UI / Demo" },
  { value: "github-daily", label: "GitHub" },
];

interface Props {
  ideaId: number;
  onPostCreated: (id: number) => void;
}

export function IdeaPanel({ ideaId, onPostCreated }: Props) {
  const [postTopic, setPostTopic] = useState("");
  const utils = trpc.useUtils();

  const { data: ideas = [] } = trpc.idea.list.useQuery(undefined, {
    refetchInterval: (query) => {
      if (query.state.data?.some((i) => i.status === "enriching")) return 3000;
      return false;
    },
  });
  const idea = ideas.find((i) => i.id === ideaId);

  const enrichMutation = trpc.idea.enrich.useMutation({
    onSuccess: () => utils.idea.list.invalidate(),
  });

  const generatePost = trpc.post.generate.useMutation({
    onSuccess: (post) => {
      utils.post.list.invalidate();
      onPostCreated(post.id);
    },
  });

  if (!idea) return null;

  function handleGenerate(type: "tweet" | "thread") {
    if (!postTopic || !idea) return;
    generatePost.mutate({ input: idea.topic, type, topic: postTopic });
  }

  const isEnriched = idea.status === "enriched";

  return (
    <div className="flex flex-col p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-7">
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-widest text-amber-500 mb-2">
            Research
          </p>
          <h1 className="text-base font-semibold text-slate-200 leading-snug">{idea.topic}</h1>
          {idea.notes && (
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">{idea.notes}</p>
          )}
        </div>
        <span className="shrink-0 text-[10px] font-mono text-slate-600">
          {new Date(idea.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      {/* Research status blocks */}
      {idea.status === "pending" && (
        <div className="rounded-2xl bg-zinc-900/70 p-5 flex flex-col gap-4">
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
        <div className="rounded-2xl bg-zinc-900/70 p-5">
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
        <div className="rounded-2xl bg-zinc-900/70 p-5 flex flex-col gap-3">
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

      {isEnriched && idea.enrichedContent && (
        <>
          <EnrichedView content={JSON.parse(idea.enrichedContent) as EnrichedContent} />

          {/* Re-research + Generate Post */}
          <div className="mt-10 pt-6 border-t border-zinc-800/60 flex flex-col gap-6">
            {/* Re-research */}
            <button
              className="self-start inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-600 hover:text-slate-400 transition-colors"
              onClick={() => enrichMutation.mutate({ id: idea.id })}
              disabled={enrichMutation.isPending}
            >
              <RotateCcw className={`w-3 h-3 ${enrichMutation.isPending ? "animate-spin" : ""}`} />
              {enrichMutation.isPending ? "researching…" : "re-research"}
            </button>

            {/* Generate Post */}
            <div>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">
                turn into post
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Topic chips */}
                {TOPIC_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPostTopic((t) => (t === opt.value ? "" : opt.value))}
                    disabled={generatePost.isPending}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide transition-colors ${
                      postTopic === opt.value
                        ? "bg-amber-500 text-zinc-950"
                        : "bg-zinc-800 text-slate-400 hover:text-slate-200 hover:bg-zinc-700"
                    } disabled:opacity-40`}
                  >
                    {opt.label}
                  </button>
                ))}

                <span className="w-px h-4 bg-zinc-800" />

                <button
                  onClick={() => handleGenerate("tweet")}
                  disabled={generatePost.isPending || !postTopic}
                  title={!postTopic ? "Pick a topic first" : undefined}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 transition-all active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {generatePost.isPending && generatePost.variables?.type === "tweet"
                    ? "writing…"
                    : "tweet"}
                </button>
                <button
                  onClick={() => handleGenerate("thread")}
                  disabled={generatePost.isPending || !postTopic}
                  title={!postTopic ? "Pick a topic first" : undefined}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide bg-blue-400 text-zinc-950 hover:bg-blue-300 disabled:bg-zinc-800 disabled:text-zinc-500 transition-all active:scale-95"
                >
                  <ScrollText className="w-3.5 h-3.5" />
                  {generatePost.isPending && generatePost.variables?.type === "thread"
                    ? "writing…"
                    : "thread"}
                </button>
              </div>
            </div>
          </div>
        </>
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
                <span className="shrink-0 w-5 h-5 rounded-md bg-zinc-800 text-[10px] font-mono text-slate-500 flex items-center justify-center">
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
                className="group block rounded-2xl bg-zinc-900/60 p-4 hover:bg-zinc-900 transition-colors"
              >
                <div className="flex items-start gap-1.5">
                  <p className="flex-1 text-sm font-medium text-blue-400 group-hover:text-blue-300 transition-colors leading-snug">
                    {link.title || urlToFilename(link.url)}
                  </p>
                  <ExternalLink className="mt-0.5 shrink-0 w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </div>
                <p className="mt-2 text-[10px] font-mono text-slate-500 truncate">
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

function urlToFilename(url: string): string {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : "";
  } catch {
    return "";
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-widest mb-4">
      {children}
    </p>
  );
}
