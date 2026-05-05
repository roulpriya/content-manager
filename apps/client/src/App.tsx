import React, { useState } from 'react';
import {
  SEED_ARTICLES,
  SEED_IDEAS,
  SEED_MEMORIES,
  SEED_POSTS,
} from './data';
import type { Article, GeneratePreload, Idea, Memory, Post } from './types';
import {
  ArticlesView,
  GenerateView,
  IdeasView,
  MemoryView,
  PostsView,
} from './views';

// ── Icons ────────────────────────────────────────────────────────────────────

function IconPosts() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function IconGenerate() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconIdeas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconMemory() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  );
}

function IconArticles() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="17" height="17" strokeWidth="1.6">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// ── Nav config ────────────────────────────────────────────────────────────────

type ViewId = 'ideas' | 'generate' | 'posts' | 'memory' | 'articles';

const NAV: { id: ViewId; label: string; Icon: () => React.ReactElement }[] = [
  { id: 'ideas',    label: 'Ideas',    Icon: IconIdeas    },
  { id: 'generate', label: 'Generate', Icon: IconGenerate },
  { id: 'posts',    label: 'Posts',    Icon: IconPosts    },
  { id: 'memory',   label: 'Memory',   Icon: IconMemory   },
  { id: 'articles', label: 'Articles', Icon: IconArticles },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ view, onNav }: { view: ViewId; onNav: (v: ViewId) => void }) {
  return (
    <div className="sidebar">
      <div className="nav-logo">Q</div>
      {NAV.map((n) => (
        <div
          key={n.id}
          className={`nav-item${view === n.id ? ' active' : ''}`}
          onClick={() => onNav(n.id)}
        >
          <n.Icon />
          <span className="tooltip">{n.label}</span>
        </div>
      ))}
      <div className="nav-spacer" />
      <div className="nav-item" style={{ marginBottom: 4 }}>
        <IconSettings />
        <span className="tooltip">Settings</span>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<ViewId>('ideas');
  const [posts, setPosts] = useState<Post[]>(SEED_POSTS);
  const [ideas, setIdeas] = useState<Idea[]>(SEED_IDEAS);
  const [memories, setMemories] = useState<Memory[]>(SEED_MEMORIES);
  const [articles, setArticles] = useState<Article[]>(SEED_ARTICLES);
  const [generatePreload, setGeneratePreload] = useState<GeneratePreload | null>(null);

  const handleSavePost = (post: Post) => {
    setPosts((ps) => [post, ...ps]);
    setMemories((ms) => [
      {
        id: Date.now(),
        topic: post.topic,
        type: post.type,
        body: Array.isArray(post.body)
          ? post.body[0]
          : (post.body as string).slice(0, 120),
        date: 'Today',
      },
      ...ms,
    ]);
    setGeneratePreload(null);
    setView('posts');
  };

  const handleGenerateFromIdea = (idea: Idea) => {
    const context = idea.enrichedContent
      ? `Topic: ${idea.topic}\n\nSummary: ${idea.enrichedContent.summary}\n\nKey facts:\n${idea.enrichedContent.facts.map((f) => '• ' + f).join('\n')}`
      : `Topic: ${idea.topic}\n\n${idea.notes}`;
    setGeneratePreload({ notes: context, topic: 'general', label: idea.topic });
    setView('generate');
  };

  const handleFollowUp = (post: Post) => {
    const orig = Array.isArray(post.body) ? post.body.join('\n\n') : post.body;
    setGeneratePreload({
      notes: `Follow-up to: "${post.title}"\n\nOriginal post:\n${orig}\n\nWrite a follow-up exploring one angle further.`,
      topic: post.topic,
      label: `Follow-up · ${post.title}`,
    });
    setView('generate');
  };

  const handleNav = (v: ViewId) => {
    setView(v);
    if (v !== 'generate') setGeneratePreload(null);
  };

  return (
    <div className="app">
      <Sidebar view={view} onNav={handleNav} />
      {view === 'ideas' && (
        <IdeasView ideas={ideas} setIdeas={setIdeas} onGenerate={handleGenerateFromIdea} />
      )}
      {view === 'generate' && (
        <GenerateView onSave={handleSavePost} preload={generatePreload} />
      )}
      {view === 'posts' && (
        <PostsView
          posts={posts}
          setPosts={setPosts}
          setMemories={setMemories}
          onFollowUp={handleFollowUp}
        />
      )}
      {view === 'memory' && (
        <MemoryView memories={memories} setMemories={setMemories} />
      )}
      {view === 'articles' && (
        <ArticlesView articles={articles} setArticles={setArticles} />
      )}
    </div>
  );
}

