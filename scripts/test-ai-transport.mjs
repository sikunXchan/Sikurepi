import assert from 'node:assert/strict';
import { generateWithRetry, getAiCallTelemetry, AiTimeoutError, AiUsageLimitError } from '../src/lib/aiTransport.ts';

let calls = [];
const response = {};
const client = (fn) => ({ models: { generateContent: async (params) => { calls.push(params); return fn(params); } } });
const policy = { retryDelayMs: 0, attemptTimeoutMs: 100, deadlineAt: Date.now() + 5000 };
const success = await generateWithRetry(client(() => response), { contents: 'test', config: { responseMimeType: 'application/json' } }, ['lite'], 2, policy);
assert.equal(success, response);
assert.equal(calls[0].config.httpOptions.retryOptions.attempts, 1);
assert.equal(calls[0].config.responseMimeType, 'application/json');
assert.equal(getAiCallTelemetry(success).attempt, 1);

calls = [];
await generateWithRetry(client(() => { if (calls.length === 1) throw { status: 429 }; return {}; }), { contents: 'test' }, ['lite'], 2, policy);
assert.equal(calls.length, 2);

calls = [];
await generateWithRetry(client(({ model }) => { if (model === 'lite') throw { status: 400 }; return {}; }), {}, ['lite', 'flash'], 2, policy);
assert.deepEqual(calls.map((p) => p.model), ['lite', 'flash']);

calls = [];
const controller = new AbortController();
const cancelled = generateWithRetry(client(() => new Promise(() => {})), {}, ['lite', 'flash'], 2, { ...policy, signal: controller.signal });
controller.abort(new DOMException('Cancelled', 'AbortError'));
await assert.rejects(cancelled, { name: 'AbortError' });
assert.equal(calls.length, 1);
assert.equal(calls[0].config.abortSignal.aborted, true);

calls = [];
await generateWithRetry(client(({ model }) => model === 'lite' ? new Promise(() => {}) : {}), {}, ['lite', 'flash'], 3, { ...policy, attemptTimeoutMs: 15 });
assert.deepEqual(calls.map((p) => p.model), ['lite', 'flash']);
assert.equal(calls[0].config.abortSignal.aborted, true);

calls = [];
await assert.rejects(generateWithRetry(client(() => new Promise(() => {})), {}, ['lite', 'flash'], 3, { deadlineAt: Date.now() + 20, attemptTimeoutMs: 100 }), AiTimeoutError);
assert.equal(calls.length, 1);
calls = [];
await assert.rejects(generateWithRetry(client(() => ({})), {}, ['lite'], 2, { deadlineAt: Date.now() - 1 }), AiTimeoutError);
assert.equal(calls.length, 0);
await assert.rejects(generateWithRetry(client(() => { throw { status: 503 }; }), {}, ['lite'], 1, policy), (e) => e.status === 503);
console.log('Retry ownership, time budgets, cancellation and model fallback: passed');
calls = [];
await assert.rejects(generateWithRetry(client(() => { throw { status: 429, message: 'Your project has exceeded its monthly spending cap.' }; }), {}, ['lite', 'flash'], 3, policy), AiUsageLimitError);
assert.equal(calls.length, 1);
console.log('Project spending limit stops retries immediately: passed');
