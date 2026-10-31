const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePush } = require('../src/parsePush');
const { buildEmbed, COLORS } = require('../src/discord');
const fixture = require('./fixtures/push.json');

const clone = () => structuredClone(fixture);

test('parsePush extracts commit message, author and branch', () => {
  const push = parsePush(fixture);
  assert.equal(push.branch, 'feat/ci-monitor');
  assert.equal(push.author, 'ckuudee');
  assert.equal(push.title, 'docs: add setup and smee.io demo instructions');
  assert.equal(
    push.body,
    'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>',
  );
  assert.equal(push.sha, '3ede924');
  assert.equal(push.repo, 'ckuudee/github-discord-ci');
  assert.equal(push.commitCount, 3);
});

test('parsePush ignores tag pushes', () => {
  const payload = clone();
  payload.ref = 'refs/tags/v1.0.0';
  assert.equal(parsePush(payload), null);
});

test('parsePush handles branch deletion (head_commit is null)', () => {
  const payload = clone();
  payload.deleted = true;
  payload.head_commit = null;
  const push = parsePush(payload);
  assert.equal(push.deleted, true);
  assert.equal(push.author, 'ckuudee'); // falls back to pusher
});

test('buildEmbed colors: default branch green, feature blurple, force yellow, delete red', () => {
  // The captured fixture is a push to a feature branch.
  assert.equal(buildEmbed(parsePush(fixture)).color, COLORS.feature);

  const main = clone();
  main.ref = 'refs/heads/main';
  assert.equal(buildEmbed(parsePush(main)).color, COLORS.push);

  const forced = clone();
  forced.forced = true;
  assert.equal(buildEmbed(parsePush(forced)).color, COLORS.forced);

  const deleted = clone();
  deleted.deleted = true;
  deleted.head_commit = null;
  assert.equal(buildEmbed(parsePush(deleted)).color, COLORS.deleted);
});

test('buildEmbed respects Discord length limits', () => {
  const payload = clone();
  payload.head_commit.message = 'x'.repeat(500) + '\n' + 'y'.repeat(5000);
  const embed = buildEmbed(parsePush(payload));
  assert.ok(embed.title.length <= 256);
  assert.ok(embed.description.length <= 4096);
});
