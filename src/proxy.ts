import { NextRequest, NextResponse } from 'next/server';
import { bodyWithinLimit, consumeRequestBudget, isAiApi, isAllowedOrigin, isRetiredApi, requestBodyLimit } from './lib/apiRequestPolicy';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (isRetiredApi(path)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (process.env.AI_REQUESTS_DISABLED === 'true' && isAiApi(path)) {
    return NextResponse.json({ error: 'AI requests are temporarily disabled' }, { status: 503 });
  }
  if ((request.method !== 'GET' && request.method !== 'HEAD') || path === '/api/daily-pick') {
    if (!isAllowedOrigin(request.headers.get('origin'), request.nextUrl.origin)) {
      return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
    }
    const maxBytes = requestBodyLimit(path);
    const length = Number(request.headers.get('content-length') || 0);
    if (length > maxBytes || !(await bodyWithinLimit(request.clone().body, maxBytes))) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    }
    // Only trust the deployment platform's overwritten IP header, not arbitrary X-Forwarded-For.
    const client = process.env.VERCEL === '1'
      ? (request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown')
      : 'local';
    if (!consumeRequestBudget(path, client)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '600' } },
      );
    }
  }
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = { matcher: '/api/:path*' };
