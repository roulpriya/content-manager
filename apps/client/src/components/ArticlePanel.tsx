import { Copy, LoaderCircle, RotateCcw } from "lucide-react";
import { useState } from "react";
import { trpc } from "../trpc";

interface Props {
  articleId: number;
}

export function ArticlePanel({ articleId }: Props) {
  const utils = trpc.useUtils();
  const [copied, setCopied] = useState(false);

  const { data: article } = trpc.article.get.useQuery(
    { id: articleId },
    {
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status === "researching" || status === "writing") return 2000;
        return false;
      },
    }
  );

  const retryMutation = trpc.article.generate.useMutation({
    onSuccess: () => utils.article.list.invalidate(),
  });

  if (!article) return null;

  function handleCopy() {
    if (!article?.body) return;
    const text = `# ${article.title}\n\n${article.body}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col p-6 pb-16">
      <div className="flex justify-end mb-8">
        <span className="text-[10px] font-mono text-slate-500">
          {new Date(article.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      <div className="mb-7">
        <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-500 mb-2">
          Article
        </p>
        <h1 className="text-base font-semibold text-slate-200 leading-snug">
          {article.title ?? article.topic}
        </h1>
        {article.wordCount && (
          <p className="mt-1.5 text-[10px] font-mono text-slate-500">
            {article.wordCount.toLocaleString()} words
          </p>
        )}
      </div>

      {(article.status === "researching" || article.status === "writing") && (
        <div className="rounded-2xl bg-zinc-900/70 p-5">
          <div className="flex items-center gap-3">
            <LoaderCircle className="w-4 h-4 text-emerald-500 animate-spin shrink-0" />
            <p className="text-sm text-emerald-500">
              {article.status === "researching"
                ? "Researching the web…"
                : "Writing the article…"}
            </p>
          </div>
          <p className="mt-2 text-[11px] font-mono text-emerald-700 ml-5">
            {article.status === "researching"
              ? "gathering sources and facts"
              : "usually takes 20–40s total"}
          </p>
        </div>
      )}

      {article.status === "error" && (
        <div className="rounded-2xl bg-zinc-900/70 p-5 flex flex-col gap-3">
          <p className="text-sm text-red-400">
            {article.errorMessage ?? "Article generation failed."}
          </p>
          <button
            className="self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 text-[11px] font-semibold text-slate-400 hover:text-slate-200 hover:bg-zinc-800 transition-colors"
            onClick={() => retryMutation.mutate({ topic: article.topic })}
            disabled={retryMutation.isPending}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            retry
          </button>
        </div>
      )}

      {article.status === "done" && article.body && (
        <>
          <div className="flex justify-end mb-6">
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-[11px] font-semibold text-slate-400 hover:text-slate-200 hover:bg-zinc-800 transition-colors"
              onClick={handleCopy}
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? "copied!" : "copy"}
            </button>
          </div>
          <MarkdownArticle body={article.body} />
        </>
      )}
    </div>
  );
}

function MarkdownArticle({ body }: { body: string }) {
  const lines = body.split("\n");

  return (
    <article className="flex flex-col gap-4">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="text-sm font-semibold text-slate-200 mt-4 leading-snug">
              {line.slice(4)}
            </h3>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="text-base font-semibold text-slate-100 mt-6 leading-snug border-b border-zinc-800 pb-2">
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <h1 key={i} className="text-lg font-bold text-slate-100 mt-2 leading-snug">
              {line.slice(2)}
            </h1>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2.5 ml-2">
              <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-slate-500" />
              <p className="text-sm text-slate-300 leading-relaxed">{renderInline(line.slice(2))}</p>
            </div>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+)\.\s(.*)$/);
          if (match) {
            return (
              <div key={i} className="flex gap-3 ml-2">
                <span className="shrink-0 w-5 h-5 rounded-md bg-zinc-800 text-[10px] font-mono text-slate-500 flex items-center justify-center mt-0.5">
                  {match[1]}
                </span>
                <p className="text-sm text-slate-300 leading-relaxed">{renderInline(match[2])}</p>
              </div>
            );
          }
        }
        if (line.startsWith("> ")) {
          return (
            <blockquote key={i} className="border-l-2 border-emerald-600 pl-4 ml-2">
              <p className="text-sm text-slate-400 italic leading-relaxed">{line.slice(2)}</p>
            </blockquote>
          );
        }
        if (line.trim() === "" || line.trim() === "---") {
          return <div key={i} className="h-1" />;
        }
        return (
          <p key={i} className="text-sm text-slate-300 leading-relaxed">
            {renderInline(line)}
          </p>
        );
      })}
    </article>
  );
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-slate-200">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="px-1 py-0.5 rounded bg-zinc-800 text-[12px] font-mono text-emerald-400">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}
