import { NextResponse } from 'next/server';

export interface ApiErrorBody {
  status: 'error';
  code: string;
  message: string;
}

/**
 * Standardized API error response helper across NyayaLens routes.
 *
 * @param code - Machine-readable error code (e.g. 'RATE_LIMIT_EXCEEDED', 'EMPTY_DOCUMENT')
 * @param message - Human-readable error description
 * @param status - HTTP status code (defaults to 400)
 * @param extraHeaders - Optional HTTP headers (e.g. Rate-limit or Retry-After headers)
 */
export function errorResponse(
  code: string,
  message: string,
  status: number = 400,
  extraHeaders?: Record<string, string>
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      status: 'error',
      code,
      message,
    },
    {
      status,
      headers: extraHeaders,
    }
  );
}
