type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  fork: boolean;
  private: boolean;
  updated_at: string;
  pushed_at: string | null;
};

type GitHubPullRequestItem = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  repository_url: string;
  updated_at: string;
  created_at: string;
  closed_at: string | null;
  pull_request: {
    url: string;
  };
};

type GitHubCommitItem = {
  sha: string;
  html_url: string;
  repository: {
    full_name: string;
    html_url: string;
  };
  commit: {
    message: string;
    author: {
      date: string;
      name: string;
    } | null;
  };
};

type GitHubSearchResponse<T> = {
  items: T[];
};

export type GitHubActivitySnapshot = {
  user: string;
  since: string;
  repositories: Array<{
    name: string;
    description: string | null;
    language: string | null;
    updatedAt: string;
    pushedAt: string | null;
    url: string;
  }>;
  pullRequests: Array<{
    repo: string;
    number: number;
    title: string;
    state: string;
    updatedAt: string;
    url: string;
  }>;
  commits: Array<{
    repo: string;
    sha: string;
    message: string;
    authoredAt: string | null;
    url: string;
  }>;
};

function getGitHubToken(): string | null {
  return process.env.GITHUB_TOKEN?.trim() || null;
}

async function githubRequest<T>(path: string): Promise<T> {
  const token = getGitHubToken();
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required for GitHub activity sync");
  }

  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "content-manager",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GitHub API request failed (${response.status}): ${message}`);
  }

  return (await response.json()) as T;
}

async function resolveGitHubUsername(): Promise<string> {
  const explicit = process.env.GITHUB_USERNAME?.trim();
  if (explicit) return explicit;

  const profile = await githubRequest<{ login: string }>("/user");
  return profile.login;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function trimCommitMessage(message: string): string {
  const firstLine = message.split("\n")[0]?.trim() ?? "";
  return firstLine.length > 140 ? `${firstLine.slice(0, 137)}...` : firstLine;
}

export async function fetchRecentGitHubActivity(
  days = 14,
  limits?: {
    repositories?: number;
    pullRequests?: number;
    commits?: number;
  }
): Promise<GitHubActivitySnapshot> {
  const username = await resolveGitHubUsername();
  const since = isoDaysAgo(days);
  const repoLimit = Math.max(1, Math.min(limits?.repositories ?? 8, 20));
  const prLimit = Math.max(1, Math.min(limits?.pullRequests ?? 8, 20));
  const commitLimit = Math.max(1, Math.min(limits?.commits ?? 12, 20));

  const [repositories, pullRequests, commits] = await Promise.all([
    githubRequest<GitHubRepo[]>(
      `/user/repos?sort=updated&direction=desc&per_page=${repoLimit}&affiliation=owner,collaborator,organization_member`
    ),
    githubRequest<GitHubSearchResponse<GitHubPullRequestItem>>(
      `/search/issues?q=${encodeURIComponent(
        `is:pr author:${username} updated:>=${since} archived:false`
      )}&sort=updated&order=desc&per_page=${prLimit}`
    ),
    githubRequest<GitHubSearchResponse<GitHubCommitItem>>(
      `/search/commits?q=${encodeURIComponent(
        `author:${username} committer-date:>=${since}`
      )}&sort=author-date&order=desc&per_page=${commitLimit}`
    ),
  ]);

  return {
    user: username,
    since,
    repositories: repositories.map((repo) => ({
      name: repo.full_name,
      description: repo.description,
      language: repo.language,
      updatedAt: repo.updated_at,
      pushedAt: repo.pushed_at,
      url: repo.html_url,
    })),
    pullRequests: pullRequests.items.map((pr) => ({
      repo: pr.repository_url.split("/repos/")[1] ?? pr.repository_url,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      updatedAt: pr.updated_at,
      url: pr.html_url,
    })),
    commits: commits.items.map((commit) => ({
      repo: commit.repository.full_name,
      sha: commit.sha,
      message: trimCommitMessage(commit.commit.message),
      authoredAt: commit.commit.author?.date ?? null,
      url: commit.html_url,
    })),
  };
}

export function formatGitHubActivityForPrompt(activity: GitHubActivitySnapshot): string {
  const repoLines = activity.repositories.length
    ? activity.repositories
        .map((repo) => {
          const language = repo.language ? ` | ${repo.language}` : "";
          const description = repo.description ? ` | ${repo.description}` : "";
          return `- Repo: ${repo.name}${language}${description}`;
        })
        .join("\n")
    : "- No recent repository updates found.";

  const prLines = activity.pullRequests.length
    ? activity.pullRequests
        .map((pr) => `- PR: ${pr.repo}#${pr.number} | ${pr.title} | ${pr.state}`)
        .join("\n")
    : "- No recent pull requests found.";

  const commitLines = activity.commits.length
    ? activity.commits
        .map((commit) => `- Commit: ${commit.repo} | ${commit.message} (${commit.sha.slice(0, 7)})`)
        .join("\n")
    : "- No recent commits found.";

  return `Recent GitHub activity for ${activity.user} since ${new Date(activity.since).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  )}:

Repositories:
${repoLines}

Pull requests:
${prLines}

Commits:
${commitLines}`;
}
