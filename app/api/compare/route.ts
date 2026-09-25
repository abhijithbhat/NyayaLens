import { NextRequest, NextResponse } from 'next/server';
import { ParsedDocument } from '@/lib/types';
import { compareDocuments } from '@/lib/compare';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';
import { errorResponse } from '@/lib/apiError';

export async function POST(req: NextRequest): Promise<NextResponse<any>> {
  const rateLimit = checkRateLimit(req);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const body = await req.json();
    const { documentA, documentB } = body as {
      documentA?: ParsedDocument;
      documentB?: ParsedDocument;
    };

    if (!documentA || !Array.isArray(documentA.clauses) || !documentB || !Array.isArray(documentB.clauses)) {
      return errorResponse(
        'INVALID_DOCUMENTS',
        'Both documentA and documentB must be provided with valid clauses arrays.',
        400
      );
    }

    if (documentA.clauses.length === 0 && documentB.clauses.length === 0) {
      return errorResponse(
        'EMPTY_DOCUMENTS',
        'Both documents are empty. Cannot compare documents without clauses.',
        400
      );
    }

    const comparisonResult = await compareDocuments(documentA, documentB);

    return NextResponse.json({
      status: 'success',
      data: comparisonResult,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown comparison error';
    console.error('Error in /api/compare:', error);

    return errorResponse(
      'COMPARE_FAILED',
      `Comparison failed: ${errorMsg}`,
      500
    );
  }
}

