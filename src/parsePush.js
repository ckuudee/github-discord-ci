const BRANCH_PREFIX = 'refs/heads/';

// Reduce a GitHub `push` payload to the fields the Discord embed needs.
// Returns null for pushes we don't report (tags).
function parsePush(payload) {
  const ref = payload.ref || '';
  if (!ref.startsWith(BRANCH_PREFIX)) return null;

  const head = payload.head_commit; // null when a branch is deleted
  const message = head?.message || '';
  const [title, ...rest] = message.split('\n');

  return {
    repo: payload.repository?.full_name,
    repoUrl: payload.repository?.html_url,
    branch: ref.slice(BRANCH_PREFIX.length),
    defaultBranch: payload.repository?.default_branch,
    author: head?.author?.name || payload.pusher?.name,
    avatarUrl: payload.sender?.avatar_url,
    title,
    body: rest.join('\n').trim(),
    sha: head?.id?.slice(0, 7),
    commitUrl: head?.url,
    compareUrl: payload.compare,
    commitCount: payload.commits?.length ?? 0,
    timestamp: head?.timestamp,
    forced: Boolean(payload.forced),
    deleted: Boolean(payload.deleted),
  };
}

module.exports = { parsePush };
