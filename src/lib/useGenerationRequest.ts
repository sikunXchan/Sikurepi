"use client";

import { useEffect, useRef } from 'react';

/** Prevent double taps and cancel abandoned requests, including their retry loops. */
export function useGenerationRequest() {
  const active = useRef<{ controller: AbortController; dispose: () => void } | null>(null);
  useEffect(() => () => {
    active.current?.controller.abort(new DOMException('Page closed', 'AbortError'));
    active.current?.dispose();
  }, []);
  return {
    isRunning: () => active.current !== null,
    begin: (timeoutMs: number) => {
      if (active.current) return null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new DOMException('Generation timed out', 'TimeoutError')), timeoutMs);
      const request = { controller, dispose: () => {
        clearTimeout(timer);
        if (active.current === request) active.current = null;
      } };
      active.current = request;
      return { signal: controller.signal, dispose: request.dispose };
    },
  };
}
