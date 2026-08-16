import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { fieldErrors } from './validation';
import { AuthError } from './auth';

/**
 * Uniform API responses. Every route returns either
 *   { data: … }                       on success, or
 *   { error, code, details? }         on failure
 * so the client never has to guess at the shape.
 */

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, { status: 200, ...init });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

export function fail(
  message: string,
  code: string,
  status = 400,
  details?: Record<string, string[]>,
): NextResponse {
  return NextResponse.json({ error: message, code, ...(details ? { details } : {}) }, { status });
}

export function tooManyRequests(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      error: `Too many requests. Try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'}.`,
      code: 'rate_limited',
    },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
}

/**
 * Single catch-all for route handlers. Known error types map to a useful
 * status; anything else is logged with an id and reported generically, so an
 * internal message never leaks to the customer.
 */
export function handleError(error: unknown, context: string): NextResponse {
  if (error instanceof ZodError) {
    return fail('Please check the highlighted fields', 'validation_error', 422, fieldErrors(error));
  }
  if (error instanceof AuthError) {
    return fail(error.message, error.status === 403 ? 'forbidden' : 'unauthorized', error.status);
  }

  const ref = Math.random().toString(36).slice(2, 10);
  console.error(`[api:${context}] ref=${ref}`, error);
  return fail(
    `Something went wrong on our side. Quote reference ${ref} if you contact support.`,
    'internal_error',
    500,
  );
}

/** Parse a JSON body, turning a malformed payload into a clean 400. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new BadRequest('Request body must be valid JSON');
  }
}

export class BadRequest extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequest';
  }
}
