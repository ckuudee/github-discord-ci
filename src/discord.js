// Embed colors are decimal integers, not hex strings.
const COLORS = {
  push: 0x57f287, // green
  feature: 0x5865f2, // blurple
  forced: 0xfee75c, // yellow
  deleted: 0xed4245, // red
};

const truncate = (text, max) =>
  text.length > max ? text.slice(0, max - 1) + '…' : text;

function pickColor(push) {
  if (push.deleted) return COLORS.deleted;
  if (push.forced) return COLORS.forced;
  if (push.branch !== push.defaultBranch) return COLORS.feature;
  return COLORS.push;
}

// Discord limits: title 256, description 4096, field value 1024.
function buildEmbed(push) {
  const fields = [
    { name: 'Branch', value: `\`${push.branch}\``, inline: true },
    { name: 'Repository', value: `[${push.repo}](${push.repoUrl})`, inline: true },
  ];

  if (push.deleted) {
    return {
      title: `Branch deleted: ${truncate(push.branch, 200)}`,
      color: pickColor(push),
      author: { name: push.author, icon_url: push.avatarUrl },
      fields,
    };
  }

  fields.push({
    name: 'Commit',
    value: `[\`${push.sha}\`](${push.commitUrl})`,
    inline: true,
  });

  const prefix = push.forced ? '⚠️ Force push: ' : '';
  const embed = {
    title: truncate(prefix + push.title, 256),
    url: push.commitUrl,
    color: pickColor(push),
    author: { name: push.author, icon_url: push.avatarUrl },
    fields,
    footer: {
      text: `${push.commitCount} commit${push.commitCount === 1 ? '' : 's'} pushed`,
    },
    timestamp: push.timestamp,
  };
  if (push.body) embed.description = truncate(push.body, 4096);
  return embed;
}

async function sendEmbed(webhookUrl, embed) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'CI Monitor', embeds: [embed] }),
  });

  if (res.status === 429) {
    const { retry_after } = await res.json().catch(() => ({}));
    throw new Error(`Discord rate limited, retry after ${retry_after ?? '?'}s`);
  }
  if (!res.ok) {
    throw new Error(`Discord responded ${res.status}: ${await res.text()}`);
  }
}

module.exports = { buildEmbed, sendEmbed, COLORS };
