export type PostType = 'tweet' | 'thread';
export type PostStatus = 'idea' | 'generated' | 'accepted' | 'rejected' | 'published';
export type IdeaStatus = 'pending' | 'enriching' | 'enriched';
export type ArticleStatus = 'researching' | 'writing' | 'done';

export interface EnrichedContent {
  summary: string;
  facts: string[];
  sources: string[];
}

export interface Post {
  id: number;
  title: string;
  type: PostType;
  topic: string;
  status: PostStatus;
  scheduledFor: string | null;
  body: string | string[];
}

export interface Idea {
  id: number;
  topic: string;
  notes: string;
  status: IdeaStatus;
  enrichedContent: EnrichedContent | null;
}

export interface Memory {
  id: number;
  topic: string;
  type: PostType;
  body: string;
  date: string;
}

export interface Article {
  id: number;
  topic: string;
  status: ArticleStatus;
  title: string | null;
  body: string | null;
  wordCount: number;
}

export interface GeneratePreload {
  notes: string;
  topic: string;
  label: string;
}
