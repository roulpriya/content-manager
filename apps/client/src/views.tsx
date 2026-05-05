import { useEffect, useRef, useState } from 'react';
import { ARTICLE_BODY, SAMPLES, TOPIC_ICONS, TOPIC_LABELS, TOPICS } from './data';
import type { Article, Idea, Memory, Post, GeneratePreload } from './types';

// ── Shared ──────────────────────────────────────────────────────────────────

export function Badge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

export function CopyBtn({ text }: { text: string | string[] }) {
  const [copied, setCopied] = useState(false);
  const full = Array.isArray(text) ? text.join('\n\n') : text;
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => {
        navigator.clipboard?.writeText(full).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

// ── PostsView ────────────────────────────────────────────────────────────────

interface PostsViewProps {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  setMemories: React.Dispatch<React.SetStateAction<Memory[]>>;
  onFollowUp: (post: Post) => void;
}

export function PostsView({ posts, setPosts, setMemories, onFollowUp }: PostsViewProps) {
  const [sel, setSel] = useState<number | null>(posts[0]?.id ?? null);
  const post = posts.find((p) => p.id === sel);

  const setStatus = (id: number, status: Post['status']) => {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, status } : p)));
    if (status === 'accepted') {
      const p = posts.find((x) => x.id === id);
      if (p) {
        setMemories((ms) => [
          {
            id: Date.now(),
            topic: p.topic,
            type: p.type,
            body: Array.isArray(p.body) ? p.body[0] : p.body,
            date: 'Today',
          },
          ...ms,
        ]);
      }
    }
  };

  return (
    <>
      <div className="list-panel">
        <div className="panel-header">
          <div className="panel-title">Posts</div>
          <div className="panel-subtitle">
            {posts.length} posts · {posts.filter((p) => p.status === 'generated').length} awaiting review
          </div>
        </div>
        <div className="panel-scroll">
          {posts.map((p) => (
            <div
              key={p.id}
              className={`list-item${sel === p.id ? ' selected' : ''}`}
              onClick={() => setSel(p.id)}
            >
              <div className="list-item-title">{p.title}</div>
              <div className="list-item-meta">
                <Badge status={p.status} />
                <span>{TOPIC_LABELS[p.topic]}</span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span>{p.type}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="main-panel">
        {post ? (
          <PostDetail post={post} onSetStatus={setStatus} onFollowUp={onFollowUp} />
        ) : (
          <div className="empty">Select a post to review</div>
        )}
      </div>
    </>
  );
}

function PostDetail({
  post,
  onSetStatus,
  onFollowUp,
}: {
  post: Post;
  onSetStatus: (id: number, status: Post['status']) => void;
  onFollowUp: (post: Post) => void;
}) {
  const isThread = post.type === 'thread';
  const tweets = isThread ? (post.body as string[]) : null;
  const tweetText = !isThread ? (post.body as string) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="main-header">
        <div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}
          >
            {TOPIC_LABELS[post.topic]} · {post.type}
            {post.scheduledFor ? ` · ${post.scheduledFor}` : ''}
          </div>
          <div className="main-title">{post.title}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge status={post.status} />
          <CopyBtn text={post.body} />
        </div>
      </div>
      <div className="main-scroll">
        {isThread
          ? tweets!.map((t, i) => (
              <div key={i} className="tweet-item">
                <div className="tweet-num">
                  Tweet {i + 1}/{tweets!.length}
                </div>
                <div className="post-body">{t}</div>
                <div className="char-count">{t.length} chars</div>
              </div>
            ))
          : tweetText && (
              <div className="tweet-item">
                <div className="post-body">{tweetText}</div>
                <div
                  className="char-count"
                  style={{ color: tweetText.length > 280 ? 'var(--red)' : 'var(--muted)' }}
                >
                  {tweetText.length}/280
                </div>
              </div>
            )}
        <hr className="divider" />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {post.status === 'generated' && (
            <>
              <button className="btn btn-accept" onClick={() => onSetStatus(post.id, 'accepted')}>
                ✓ Accept
              </button>
              <button className="btn btn-reject" onClick={() => onSetStatus(post.id, 'rejected')}>
                ✕ Reject
              </button>
            </>
          )}
          {post.status === 'accepted' && (
            <>
              <button className="btn btn-publish" onClick={() => onSetStatus(post.id, 'published')}>
                ↗ Mark Published
              </button>
              <button className="btn btn-secondary" onClick={() => onFollowUp(post)}>
                ↩ Create follow-up
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onSetStatus(post.id, 'rejected')}
                style={{ marginLeft: 'auto' }}
              >
                Remove from Memory
              </button>
            </>
          )}
          {post.status === 'published' && (
            <>
              <button className="btn btn-secondary" onClick={() => onFollowUp(post)}>
                ↩ Create follow-up
              </button>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--muted)',
                  marginLeft: 'auto',
                  alignSelf: 'center',
                }}
              >
                Published · in style memory
              </div>
            </>
          )}
          {post.status === 'rejected' && (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Rejected · not in style memory
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── GenerateView ─────────────────────────────────────────────────────────────

interface GenerateViewProps {
  onSave: (post: Post) => void;
  preload: GeneratePreload | null;
}

export function GenerateView({ onSave, preload }: GenerateViewProps) {
  const [step, setStep] = useState<'input' | 'streaming' | 'result' | 'saved'>('input');
  const [notes, setNotes] = useState(preload?.notes ?? '');
  const [topic, setTopic] = useState(preload?.topic ?? 'general');
  const [postType, setPostType] = useState<'tweet' | 'thread'>('tweet');
  const [streamedTexts, setStreamedTexts] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (preload) {
      setNotes(preload.notes ?? '');
      setTopic(preload.topic ?? 'general');
      setStep('input');
      setStreamedTexts([]);
      setShowFeedback(false);
    }
  }, [preload]);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const streamTweet = (text: string) => {
    let i = 0;
    setStreamedTexts(['']);
    timerRef.current = window.setInterval(() => {
      i++;
      setStreamedTexts([text.slice(0, i)]);
      if (i >= text.length) {
        clearTimer();
        setIsStreaming(false);
      }
    }, 7);
  };

  const streamThread = (tweets: string[], idx: number) => {
    if (idx >= tweets.length) {
      setIsStreaming(false);
      return;
    }
    let i = 0;
    const tweet = tweets[idx];
    setStreamedTexts((prev) => [...prev, '']);
    timerRef.current = window.setInterval(() => {
      i++;
      setStreamedTexts((prev) => {
        const n = [...prev];
        n[idx] = tweet.slice(0, i);
        return n;
      });
      if (i >= tweet.length) {
        clearTimer();
        timerRef.current = window.setTimeout(() => streamThread(tweets, idx + 1), 180);
      }
    }, 7);
  };

  const generate = () => {
    clearTimer();
    setStep('streaming');
    setIsStreaming(true);
    setStreamedTexts([]);
    const sample = SAMPLES[topic];
    if (postType === 'tweet') streamTweet(sample.tweet);
    else streamThread(sample.thread, 0);
  };

  useEffect(() => () => clearTimer(), []);

  const lastSample =
    postType === 'tweet'
      ? SAMPLES[topic].tweet
      : SAMPLES[topic].thread[SAMPLES[topic].thread.length - 1];
  const isDone =
    !isStreaming &&
    step === 'streaming' &&
    streamedTexts.length > 0 &&
    streamedTexts[streamedTexts.length - 1] === lastSample;

  useEffect(() => {
    if (isDone) setStep('result');
  }, [isDone]);

  const handleAccept = () => {
    const title = notes.trim().slice(0, 50) || `${TOPIC_LABELS[topic]} post`;
    const body = postType === 'tweet' ? SAMPLES[topic].tweet : SAMPLES[topic].thread;
    onSave({
      id: Date.now(),
      title,
      type: postType,
      topic,
      status: 'accepted',
      scheduledFor: null,
      body,
    });
    setStep('saved');
  };

  const handleReject = () => setStep('input');
  const handleRegen = () => {
    setFeedback('');
    setShowFeedback(false);
    generate();
  };

  if (step === 'saved') {
    return (
      <div
        className="main-panel"
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 40, color: 'var(--green)' }}>✓</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 500 }}>
          Post accepted
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Added to style memory · view in Posts
        </div>
        <button
          className="btn btn-primary"
          style={{ marginTop: 8 }}
          onClick={() => setStep('input')}
        >
          Generate another
        </button>
      </div>
    );
  }

  return (
    <div className="main-panel">
      <div className="main-header">
        <div className="main-title">Generate Post</div>
        {step !== 'input' && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              clearTimer();
              setStep('input');
              setStreamedTexts([]);
              setIsStreaming(false);
            }}
          >
            ← Start over
          </button>
        )}
      </div>
      <div className="main-scroll">
        {step === 'input' && (
          <div style={{ maxWidth: 640 }}>
            {preload?.label && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 20,
                  padding: '8px 12px',
                  background: 'var(--accent-bg)',
                  borderRadius: 8,
                  border: '1px solid oklch(72% 0.14 65 / 0.25)',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--accent)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Context
                </span>
                <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>
                  {preload.label}
                </span>
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <label>Rough Notes</label>
              <textarea
                className="textarea"
                rows={6}
                style={{ marginTop: 8 }}
                placeholder="Dump your thoughts here — bullet points, fragments, observations. Doesn't need to be clean."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label>Topic Preset</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {TOPICS.map((t) => (
                  <button
                    key={t}
                    className={`chip${topic === t ? ' active' : ''}`}
                    onClick={() => setTopic(t)}
                  >
                    {TOPIC_ICONS[t]} {TOPIC_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 28 }}>
              <label>Format</label>
              <div className="toggle-group" style={{ marginTop: 8 }}>
                <button
                  className={`toggle-btn${postType === 'tweet' ? ' active' : ''}`}
                  onClick={() => setPostType('tweet')}
                >
                  Single tweet
                </button>
                <button
                  className={`toggle-btn${postType === 'thread' ? ' active' : ''}`}
                  onClick={() => setPostType('thread')}
                >
                  Thread (5)
                </button>
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{ minWidth: 140 }}
              onClick={generate}
              disabled={!notes.trim()}
            >
              Generate →
            </button>
          </div>
        )}

        {(step === 'streaming' || step === 'result') && (
          <div style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              {isStreaming && <span className="spinner" />}
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
                {isStreaming ? 'Writing…' : 'Draft ready'}
              </span>
              {!isStreaming && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--green)',
                    background: 'var(--green-bg)',
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}
                >
                  ✓ Done
                </span>
              )}
            </div>

            {postType === 'tweet' ? (
              <div className="tweet-item">
                <div className="post-body">
                  {streamedTexts[0] ?? ''}
                  {isStreaming && <span className="cursor" />}
                </div>
                {!isStreaming && (
                  <div className="char-count">{(streamedTexts[0] ?? '').length}/280</div>
                )}
              </div>
            ) : (
              SAMPLES[topic].thread.map(
                (_, i) =>
                  streamedTexts[i] !== undefined && (
                    <div key={i} className="tweet-item">
                      <div className="tweet-num">Tweet {i + 1}/5</div>
                      <div className="post-body">
                        {streamedTexts[i]}
                        {isStreaming && i === streamedTexts.length - 1 && (
                          <span className="cursor" />
                        )}
                      </div>
                    </div>
                  ),
              )
            )}

            {step === 'result' && !showFeedback && (
              <>
                <hr className="divider" />
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn btn-accept" onClick={handleAccept}>
                    ✓ Accept & Save
                  </button>
                  <button className="btn btn-reject" onClick={handleReject}>
                    ✕ Reject
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowFeedback(true)}
                  >
                    ↺ Regenerate with feedback
                  </button>
                </div>
              </>
            )}

            {showFeedback && (
              <>
                <hr className="divider" />
                <div style={{ marginBottom: 12 }}>
                  <label>Feedback</label>
                  <textarea
                    className="textarea"
                    rows={3}
                    style={{ marginTop: 8 }}
                    placeholder="e.g. Make it shorter. More technical tone. End with a question."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" onClick={handleRegen}>
                    ↺ Regenerate
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowFeedback(false)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── IdeasView ─────────────────────────────────────────────────────────────────

interface IdeasViewProps {
  ideas: Idea[];
  setIdeas: React.Dispatch<React.SetStateAction<Idea[]>>;
  onGenerate: (idea: Idea) => void;
}

export function IdeasView({ ideas, setIdeas, onGenerate }: IdeasViewProps) {
  const [sel, setSel] = useState<number | null>(ideas[0]?.id ?? null);
  const [enriching, setEnriching] = useState<number | null>(null);
  const [newTopic, setNewTopic] = useState('');
  const idea = ideas.find((x) => x.id === sel);

  const addIdea = () => {
    if (!newTopic.trim()) return;
    const id = Date.now();
    setIdeas((prev) => [
      { id, topic: newTopic.trim(), notes: '', status: 'pending', enrichedContent: null },
      ...prev,
    ]);
    setSel(id);
    setNewTopic('');
  };

  const enrich = (id: number) => {
    setEnriching(id);
    setIdeas((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'enriching' } : x)));
    setTimeout(() => {
      setIdeas((prev) =>
        prev.map((x) =>
          x.id === id
            ? {
                ...x,
                status: 'enriched',
                enrichedContent: {
                  summary:
                    'This topic sits at the intersection of developer tooling and AI adoption. Recent discourse centers on practical tradeoffs — latency, cost, and maintenance burden — rather than theoretical capability comparisons.',
                  facts: [
                    'Vector search latency at production scale adds 50–200ms per query',
                    'Fine-tuning requires 500+ quality examples for reliable behavioral shift',
                    'RAG retrieval quality degrades without periodic re-embedding',
                    'Hybrid approaches (RAG + LoRA) dominate enterprise deployments in 2025',
                  ],
                  sources: [
                    'RAG vs Fine-tuning: Empirical Benchmark 2025',
                    'Production LLM Patterns — a16z',
                    'LoRA: Low-Rank Adaptation Paper (Hu et al.)',
                  ],
                },
              }
            : x,
        ),
      );
      setEnriching(null);
    }, 2800);
  };

  void enriching;

  return (
    <>
      <div className="list-panel">
        <div className="panel-header">
          <div className="panel-title">Ideas</div>
          <div className="panel-subtitle">
            {ideas.length} ideas · {ideas.filter((x) => x.status === 'enriched').length} enriched
          </div>
        </div>
        <div
          style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: 6,
          }}
        >
          <input
            className="input"
            style={{ fontSize: 12, padding: '6px 10px' }}
            placeholder="Add idea…"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addIdea()}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={addIdea}
            style={{ whiteSpace: 'nowrap' }}
          >
            + Add
          </button>
        </div>
        <div className="panel-scroll">
          {ideas.map((x) => (
            <div
              key={x.id}
              className={`list-item${sel === x.id ? ' selected' : ''}`}
              onClick={() => setSel(x.id)}
            >
              <div className="list-item-title">{x.topic}</div>
              <div className="list-item-meta">
                <Badge status={x.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="main-panel">
        {idea ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="main-header">
              <div className="main-title" style={{ fontSize: 18 }}>
                {idea.topic}
              </div>
              <Badge status={idea.status} />
            </div>
            <div className="main-scroll">
              {idea.status === 'pending' && (
                <div style={{ maxWidth: 520 }}>
                  <p
                    style={{
                      fontSize: 13,
                      color: 'var(--muted)',
                      marginBottom: 24,
                      lineHeight: 1.7,
                    }}
                  >
                    Enrich this idea with web research — get a summary, key facts, and source links
                    to use as generation context.
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary" onClick={() => enrich(idea.id)}>
                      ⟳ Enrich with research
                    </button>
                    <button className="btn btn-secondary" onClick={() => onGenerate(idea)}>
                      Generate post →
                    </button>
                  </div>
                </div>
              )}
              {idea.status === 'enriching' && (
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    color: 'var(--muted)',
                    fontSize: 13,
                  }}
                >
                  <span className="spinner" /> Searching the web…
                </div>
              )}
              {idea.status === 'enriched' && idea.enrichedContent && (
                <div style={{ maxWidth: 580 }}>
                  <div className="section-label">Summary</div>
                  <div className="card" style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text)' }}>
                      {idea.enrichedContent.summary}
                    </p>
                  </div>
                  <div className="section-label">Key Facts</div>
                  <div className="card" style={{ marginBottom: 20 }}>
                    {idea.enrichedContent.facts.map((f, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          gap: 10,
                          marginBottom: 10,
                          fontSize: 13,
                          lineHeight: 1.6,
                        }}
                      >
                        <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>
                          →
                        </span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                  <div className="section-label">Sources</div>
                  <div className="card" style={{ marginBottom: 20 }}>
                    {idea.enrichedContent.sources.map((s, i) => (
                      <div
                        key={i}
                        style={{
                          fontSize: 12,
                          color: 'var(--teal)',
                          padding: '4px 0',
                          borderBottom:
                            i < idea.enrichedContent!.sources.length - 1
                              ? '1px solid var(--border)'
                              : 'none',
                        }}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-primary" onClick={() => onGenerate(idea)}>
                    Generate post from this idea →
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty">Select an idea or add a new one</div>
        )}
      </div>
    </>
  );
}

// ── MemoryView ────────────────────────────────────────────────────────────────

interface MemoryViewProps {
  memories: Memory[];
  setMemories: React.Dispatch<React.SetStateAction<Memory[]>>;
}

export function MemoryView({ memories, setMemories }: MemoryViewProps) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<number | null>(memories[0]?.id ?? null);
  const filtered = memories.filter(
    (m) =>
      !q ||
      m.body.toLowerCase().includes(q.toLowerCase()) ||
      m.topic.toLowerCase().includes(q.toLowerCase()),
  );
  const mem = filtered.find((m) => m.id === sel);

  return (
    <>
      <div className="list-panel">
        <div className="panel-header">
          <div className="panel-title">Style Memory</div>
          <div className="panel-subtitle">{memories.length} posts in memory</div>
        </div>
        <div className="search-wrap">
          <input
            className="input"
            style={{ fontSize: 12, padding: '7px 10px' }}
            placeholder="Search memory…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(filtered[0]?.id ?? null);
            }}
          />
        </div>
        <div className="panel-scroll">
          {filtered.map((m) => (
            <div
              key={m.id}
              className={`list-item${sel === m.id ? ' selected' : ''}`}
              onClick={() => setSel(m.id)}
            >
              <div className="list-item-title" style={{ fontSize: 11, lineHeight: 1.5 }}>
                {m.body.slice(0, 70)}…
              </div>
              <div className="list-item-meta">
                <span
                  style={{
                    color: 'var(--accent)',
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  {TOPIC_LABELS[m.topic]}
                </span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span>{m.type}</span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span>{m.date}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="empty" style={{ paddingTop: 24 }}>
              No results
            </div>
          )}
        </div>
      </div>
      <div className="main-panel">
        {mem ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="main-header">
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--muted)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 4,
                  }}
                >
                  {TOPIC_LABELS[mem.topic]} · {mem.type} · {mem.date}
                </div>
                <div style={{ fontSize: 14, color: 'var(--muted)' }}>
                  Memory entry #{String(mem.id).slice(-4)}
                </div>
              </div>
              <button
                className="btn btn-reject btn-sm"
                onClick={() => {
                  setMemories((ms) => ms.filter((m) => m.id !== mem.id));
                  setSel(filtered.find((m) => m.id !== mem.id)?.id ?? null);
                }}
              >
                Delete
              </button>
            </div>
            <div className="main-scroll">
              <div className="tweet-item">
                <div className="post-body">{mem.body}</div>
              </div>
              <div
                style={{
                  marginTop: 20,
                  padding: 16,
                  background: 'var(--panel)',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--muted)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 8,
                  }}
                >
                  Memory Agent
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                  This post is indexed in your style memory. It will be surfaced as context when
                  generating posts with topic{' '}
                  <span style={{ color: 'var(--accent)' }}>{TOPIC_LABELS[mem.topic]}</span> or
                  similar content.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty">Select a memory entry</div>
        )}
      </div>
    </>
  );
}

// ── ArticlesView ──────────────────────────────────────────────────────────────

interface ArticlesViewProps {
  articles: Article[];
  setArticles: React.Dispatch<React.SetStateAction<Article[]>>;
}

export function ArticlesView({ articles, setArticles }: ArticlesViewProps) {
  const [sel, setSel] = useState<number | null>(articles[0]?.id ?? null);
  const [newTopic, setNewTopic] = useState('');
  const [progress, setProgress] = useState<Record<number, number>>({});
  const article = articles.find((a) => a.id === sel);

  const startArticle = () => {
    const topicStr = newTopic.trim();
    if (!topicStr) return;
    const id = Date.now();
    setArticles((prev) => [
      { id, topic: topicStr, status: 'researching', title: null, body: null, wordCount: 0 },
      ...prev,
    ]);
    setSel(id);
    setNewTopic('');
    setProgress((p) => ({ ...p, [id]: 0 }));

    let p = 0;
    const researchInt = setInterval(() => {
      p += 4;
      setProgress((prev) => ({ ...prev, [id]: Math.min(p, 100) }));
      if (p >= 100) {
        clearInterval(researchInt);
        setArticles((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: 'writing' } : a)),
        );
        setTimeout(() => {
          setArticles((prev) =>
            prev.map((a) =>
              a.id === id
                ? { ...a, status: 'done', title: topicStr, body: ARTICLE_BODY, wordCount: 1847 }
                : a,
            ),
          );
        }, 4000);
      }
    }, 120);
  };

  return (
    <>
      <div className="list-panel">
        <div className="panel-header">
          <div className="panel-title">Articles</div>
          <div className="panel-subtitle">
            {articles.length} articles · {articles.filter((a) => a.status === 'done').length} done
          </div>
        </div>
        <div
          style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: 6,
          }}
        >
          <input
            className="input"
            style={{ fontSize: 12, padding: '6px 10px' }}
            placeholder="New article topic…"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startArticle()}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={startArticle}
            style={{ whiteSpace: 'nowrap' }}
          >
            Write
          </button>
        </div>
        <div className="panel-scroll">
          {articles.map((a) => (
            <div
              key={a.id}
              className={`list-item${sel === a.id ? ' selected' : ''}`}
              onClick={() => setSel(a.id)}
            >
              <div className="list-item-title">{a.topic}</div>
              <div className="list-item-meta">
                <Badge status={a.status} />
                {a.wordCount > 0 && <span>{a.wordCount.toLocaleString()} words</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="main-panel">
        {article ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="main-header">
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--muted)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 6,
                  }}
                >
                  {article.status === 'done'
                    ? `${article.wordCount} words · Medium-ready`
                    : 'In progress'}
                </div>
                <div className="main-title" style={{ fontSize: 18 }}>
                  {article.title ?? article.topic}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge status={article.status} />
                {article.status === 'done' && <CopyBtn text={article.body ?? ''} />}
              </div>
            </div>
            <div className="main-scroll">
              {article.status === 'researching' && (
                <div style={{ maxWidth: 480 }}>
                  <div
                    style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}
                  >
                    <span className="spinner" />
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                      Researching topic…
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress[article.id] ?? 0}%` }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                    Deep web search in progress
                  </div>
                </div>
              )}
              {article.status === 'writing' && (
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    color: 'var(--muted)',
                    fontSize: 13,
                  }}
                >
                  <span className="spinner" /> Writing article… this takes a moment
                </div>
              )}
              {article.status === 'done' && article.body && (
                <div className="article-body" style={{ maxWidth: 640 }}>
                  {article.body.split('\n\n').map((block, i) => {
                    if (block.startsWith('## '))
                      return <h2 key={i}>{block.slice(3)}</h2>;
                    return <p key={i}>{block}</p>;
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty">Select an article or start a new one</div>
        )}
      </div>
    </>
  );
}
