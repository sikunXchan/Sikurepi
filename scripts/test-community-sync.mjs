import assert from 'node:assert/strict';
import { queueCommunityFeedback, flushCommunityFeedbackOutbox, getFeedbackSyncStatus } from '../src/lib/communityFeedbackQueue.ts';
import { communityServiceError } from '../src/lib/communityRecipeErrors.ts';

const values = new Map();
globalThis.window = new EventTarget();
window.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
const recipe = { title: '検証用のごはん', time: '10分', ingredients: [{ name: '米', amount: '1合' }], steps: ['炊く'], tips: '' };
const payload = { recipe, deviceId: 'test-device', rating: 1, note: '', source: 'completion', publish: true };
let refreshes = 0;
window.addEventListener('community-recipes-changed', () => refreshes++);
globalThis.fetch = async () => Response.json({ code: 'COMMUNITY_SCHEMA_MISSING' }, { status: 503 });
assert.equal(await queueCommunityFeedback(payload), 'service-unavailable');
assert.equal(getFeedbackSyncStatus(recipe, payload.deviceId), 'service-unavailable');
assert.equal(refreshes, 0, 'a local save must not report a server success');

globalThis.fetch = async () => Response.json({ accepted: true, rankingUpdated: true, recipeId: 'remote-id' });
assert.equal(await flushCommunityFeedbackOutbox(), true);
assert.equal(getFeedbackSyncStatus(recipe, payload.deviceId), 'saved');
assert.equal(refreshes, 1, 'successful retry refreshes the public ranking');
assert.deepEqual(JSON.parse(values.get('sikurepi_community_feedback_outbox_v1')), []);

globalThis.fetch = async () => new Response('<html>Sign in</html>');
assert.equal(await queueCommunityFeedback(payload), 'pending', 'HTML 200 is not a successful feedback receipt');
globalThis.fetch = async () => Response.json({ accepted: true, rankingUpdated: false, reason: 'local-only' });
assert.equal(await queueCommunityFeedback(payload), 'service-unavailable', 'old unconfigured API must keep the rating pending');

let release;
const sent = [];
globalThis.fetch = async (_url, options) => {
  sent.push(JSON.parse(options.body).rating);
  if (sent.length === 1) await new Promise(resolve => { release = resolve; });
  return Response.json({ accepted: true, rankingUpdated: true, recipeId: 'remote-id' });
};
const first = queueCommunityFeedback(payload);
await new Promise(resolve => setImmediate(resolve));
const changed = queueCommunityFeedback({ ...payload, rating: -1, publish: false, note: '味が濃い' });
release();
await Promise.all([first, changed]);
assert.deepEqual(sent, [1, -1], 'in-flight response must not erase the updated rating');
assert.deepEqual(JSON.parse(values.get('sikurepi_community_feedback_outbox_v1')), []);

globalThis.fetch = async () => { throw new TypeError('offline'); };
assert.equal(await queueCommunityFeedback(payload), 'pending');
// ページ再起動相当: モジュール内の状態を破棄しても、保存したキューから再送できる。
const restarted = await import('../src/lib/communityFeedbackQueue.ts?restart');
assert.equal(restarted.getFeedbackSyncStatus(recipe, payload.deviceId), 'pending');
globalThis.fetch = async () => Response.json({ accepted: true, rankingUpdated: true, recipeId: 'remote-id' });
assert.equal(await restarted.flushCommunityFeedbackOutbox(), true);
assert.deepEqual(JSON.parse(values.get('sikurepi_community_feedback_outbox_v1')), []);

globalThis.fetch = async () => Response.json({ accepted: true, rankingUpdated: false });
assert.equal(await queueCommunityFeedback({ ...payload, rating: -1, publish: false }), 'local-only');
assert.deepEqual(JSON.parse(values.get('sikurepi_community_feedback_outbox_v1')), [], 'intentionally private feedback is not endlessly retried');

assert.equal(communityServiceError({ code: 'PGRST205' }).code, 'COMMUNITY_SCHEMA_MISSING');
assert.equal(communityServiceError({ code: 'PGRST202' }).code, 'COMMUNITY_SCHEMA_MISSING');
assert.equal(communityServiceError({ code: '42501' }).code, 'COMMUNITY_ACCESS_DENIED');
assert.equal(communityServiceError(new Error('network')).code, 'COMMUNITY_UNAVAILABLE');
console.log('Community sync: missing schema, offline retry, receipt verification, rating changes passed.');
