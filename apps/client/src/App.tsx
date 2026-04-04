import { useState } from "react";
import { ComposeBox } from "./components/ComposeBox";
import { FeedList } from "./components/FeedList";
import { OutputPanel } from "./components/OutputPanel";
import { IdeaPanel } from "./components/IdeaPanel";

type View = "home" | "post" | "idea";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);

  function openPost(id: number) {
    setSelectedPostId(id);
    setView("post");
  }

  function openIdea(id: number) {
    setSelectedIdeaId(id);
    setView("idea");
  }

  function goHome() {
    setView("home");
  }

  return (
    <div className="flex flex-col h-dvh max-w-2xl mx-auto w-full border-x border-[#3a3a55]">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-5 h-11 border-b border-[#3a3a55]">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
          <span className="text-xs font-semibold tracking-[0.18em] uppercase text-[#e8e8ed]">
            Quill
          </span>
        </div>
        <span className="text-[10px] font-mono text-[#28283a] tracking-widest uppercase">
          content manager
        </span>
      </header>

      {view === "home" ? (
        <>
          <ComposeBox onPostCreated={openPost} onIdeaCreated={openIdea} />
          <FeedList onSelectPost={openPost} onSelectIdea={openIdea} />
        </>
      ) : view === "post" ? (
        <div className="flex-1 overflow-y-auto">
          <OutputPanel postId={selectedPostId!} onBack={goHome} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <IdeaPanel ideaId={selectedIdeaId!} onBack={goHome} />
        </div>
      )}
    </div>
  );
}
