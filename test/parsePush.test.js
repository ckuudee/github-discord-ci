const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePush } = require('../src/parsePush');
const { buildEmbed, COLORS } = require('../src/discord');
const fixture = require('./fixtures/push.json');

const clone = () => structuredClone(fixture);

test('parsePush extracts commit message, author and branch', () => {
  const push = parsePush(fixture);
  assert.equal(push.branch, 'main');
  assert.equal(push.author, 'Octo Cat');
  assert.equal(push.title, 'feat: add webhook listener');
  assert.equal(push.body, 'Verifies the signature and parses push events.');
  assert.equal(push.sha, 'a1b2c3d');
  assert.equal(push.repo, 'octo/demo');
  assert.equal(push.commitCount, 1);
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
  assert.equal(push.author, 'octocat'); // falls back to pusher
});

test('buildEmbed colors: default branch green, feature blurple, force yellow, delete red', () => {
  assert.equal(buildEmbed(parsePush(fixture)).color, COLORS.push);

  const feature = clone();
  feature.ref = 'refs/heads/feat/x';
  assert.equal(buildEmbed(parsePush(feature)).color, COLORS.feature);

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
