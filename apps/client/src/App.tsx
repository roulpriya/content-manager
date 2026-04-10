import { ArrowLeft, Brain } from "lucide-react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { ComposeBox } from "./components/ComposeBox";
import { FeedList } from "./components/FeedList";
import { OutputPanel } from "./components/OutputPanel";
import { IdeaPanel } from "./components/IdeaPanel";
import { MemoryPanel } from "./components/MemoryPanel";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const isMemories = location.pathname === "/memories";

  return (
    <div className="flex flex-col max-w-2xl mx-auto w-full min-h-dvh">
      <header className="shrink-0 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          {!isHome && (
            <button
              className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              back
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-semibold tracking-[0.18em] uppercase text-slate-200">
              Quill
            </span>
          </div>
        </div>
        <button
          className={`inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider transition-colors ${
            isMemories
              ? "text-amber-400"
              : "text-slate-500 hover:text-slate-300"
          }`}
          onClick={() => navigate(isMemories ? "/" : "/memories")}
        >
          <Brain className="h-3.5 w-3.5" />
          memories
        </button>
      </header>

      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/memories" element={<MemoryPanel />} />
        <Route path="/posts/:postId" element={<PostRoute />} />
        <Route path="/ideas/:ideaId" element={<IdeaRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function HomeRoute() {
  const navigate = useNavigate();

  return (
    <>
      <ComposeBox
        onPostCreated={(id) => navigate(`/posts/${id}`)}
        onIdeaCreated={(id) => navigate(`/ideas/${id}`)}
      />
      <FeedList
        onSelectPost={(id) => navigate(`/posts/${id}`)}
        onSelectIdea={(id) => navigate(`/ideas/${id}`)}
      />
    </>
  );
}

function PostRoute() {
  const { postId } = useParams();
  const id = Number(postId);

  if (!Number.isInteger(id) || id <= 0) {
    return <Navigate to="/" replace />;
  }

  return <OutputPanel postId={id} />;
}

function IdeaRoute() {
  const { ideaId } = useParams();
  const id = Number(ideaId);

  if (!Number.isInteger(id) || id <= 0) {
    return <Navigate to="/" replace />;
  }

  return <IdeaPanel ideaId={id} />;
}
