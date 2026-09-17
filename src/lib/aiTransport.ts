import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';

export const FAST_AI_MODEL = 'models/gemini-3.5-flash-lite';
export const QUALITY_AI_MODEL = 'models/gemini-3.5-flash';
export const DEFAULT_AI_MODELS = [FAST_AI_MODEL, QUALITY_AI_MODEL];

type Client = { models: { generateContent: (params: GenerateContentParameters) => Promise<GenerateContentResponse> } };
export type AiCallTelemetry = {
  model: string; durationMs: number; modelIndex: number; attempt: number;
  failedAttempts: Array<{ model: string; durationMs: number; reason: string; retryable: boolean }>;
};
export type AiRequestPolicy = { deadlineAt?: number; attemptTimeoutMs?: number; signal?: AbortSignal; retryDelayMs?: number };
const telemetry = new WeakMap<object, AiCallTelemetry>();
export function getAiCallTelemetry(response: GenerateContentResponse) { return telemetry.get(response) || null; }

export class AiTimeoutError extends Error {
  status = 504;
  constructor() { super('AI generation timed out'); this.name = 'AiTimeoutError'; }
}

export class AiUsageLimitError extends Error {
  status = 429;
  constructor() { super('AI project spending limit reached'); this.name = 'AiUsageLimitError'; }
}

function checkBudget(deadline: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (Date.now() >= deadline) throw new AiTimeoutError();
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const timer = setTimeout(() => { cleanup(); resolve(); }, ms);
    const abort = () => { clearTimeout(timer); cleanup(); reject(signal?.reason); };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

/** One retry owner. SDK's default five attempts must not multiply our retries. */
export async function generateWithRetry(
  client: Client,
  params: Omit<GenerateContentParameters, 'model'>,
  models: string[] = DEFAULT_AI_MODELS,
  maxRetries = 3,
  policy: AiRequestPolicy = {},
): Promise<GenerateContentResponse> {
  const startedAt = Date.now();
  const deadline = policy.deadlineAt ?? startedAt + 180_000;
  const signal = policy.signal ?? params.config?.abortSignal;
  const failures: AiCallTelemetry['failedAttempts'] = [];
  let lastError: unknown;
  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const model = models[modelIndex];
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      checkBudget(deadline, signal);
      const attemptStartedAt = Date.now();
      const timeout = Math.max(1, Math.min(policy.attemptTimeoutMs ?? 60_000, deadline - attemptStartedAt));
      const controller = new AbortController();
      const onAbort = () => controller.abort(signal?.reason);
      signal?.addEventListener('abort', onAbort, { once: true });
      const timer = setTimeout(() => controller.abort(new AiTimeoutError()), timeout);
      // Race as well as abort: stop awaiting even if a transport ignores cancellation.
      let rejectAbort: (() => void) | undefined;
      const aborted = new Promise<never>((_, reject) => {
        rejectAbort = () => reject(controller.signal.reason);
        controller.signal.addEventListener('abort', rejectAbort, { once: true });
      });
      try {
        const response = await Promise.race([
          client.models.generateContent({ ...params, model, config: {
            ...params.config,
            abortSignal: controller.signal,
            httpOptions: { ...params.config?.httpOptions, timeout, retryOptions: { attempts: 1 } },
          } }), aborted,
        ]);
        checkBudget(deadline, signal);
        const result: AiCallTelemetry = { model, durationMs: Date.now() - startedAt, modelIndex, attempt: attempt + 1, failedAttempts: [...failures] };
        telemetry.set(response, result);
        console.info('[AI_CALL]', JSON.stringify({ outcome: 'success', ...result, failedAttempts: failures.length }));
        return response;
      } catch (error) {
        signal?.throwIfAborted(); // User cancellation must never trigger another paid call.
        lastError = error;
        const details = error as { status?: unknown; httpStatusCode?: unknown; code?: unknown; name?: string; message?: string } | null;
        const code = details?.status ?? details?.httpStatusCode ?? details?.code;
        // A project-wide spending cap cannot recover by waiting or switching models.
        if ((code === 429 || code === 'RESOURCE_EXHAUSTED') && /monthly spending cap|project.{0,40}spend(?:ing)? (?:cap|limit)/i.test(details?.message || '')) {
          console.warn('[AI_CALL]', JSON.stringify({ outcome: 'spending_limit', durationMs: Date.now() - startedAt, failedAttempts: failures.length + 1 }));
          throw new AiUsageLimitError();
        }
        const timedOut = controller.signal.reason instanceof AiTimeoutError || error instanceof AiTimeoutError;
        if (timedOut) lastError = new AiTimeoutError();
        const retryable = timedOut || [429, 500, 502, 503, 504, 'UNAVAILABLE', 'RESOURCE_EXHAUSTED'].includes(code as string | number);
        failures.push({ model, durationMs: Date.now() - attemptStartedAt, reason: timedOut ? 'timeout' : String(code ?? details?.name ?? 'transport_error'), retryable });
        // Timeout: switch model immediately instead of repeating the same stalled call.
        if (timedOut || !retryable) break;
        if (attempt < maxRetries - 1) {
          const delay = (policy.retryDelayMs ?? 1000) * 2 ** attempt;
          if (Date.now() + delay >= deadline) throw new AiTimeoutError();
          await wait(delay, signal);
        }
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (rejectAbort) controller.signal.removeEventListener('abort', rejectAbort);
      }
    }
  }
  console.warn('[AI_CALL]', JSON.stringify({ outcome: 'failed', durationMs: Date.now() - startedAt, failedAttempts: failures }));
  // Preserve the status so callers can distinguish temporary failures from bad requests.
  throw lastError ?? new Error('No AI models configured');
}
