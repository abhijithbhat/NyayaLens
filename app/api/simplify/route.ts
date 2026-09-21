import { NextRequest, NextResponse } from 'next/server';
import { Clause, SimplifyApiResponse } from '@/lib/types';
import { simplifyClausesBatched } from '@/lib/simplify';

export async function POST(request: NextRequest): Promise<NextResponse<SimplifyApiResponse>> {
  try {
    const body = await request.json();
    let clauses: Clause[] = [];
    let documentId: string | undefined = undefined;

    if (body.document && Array.isArray(body.document.clauses)) {
      clauses = body.document.clauses;
      documentId = body.document.id;
    } else if (Array.isArray(body.clauses)) {
      clauses = body.clauses;
      documentId = body.id;
    } else if (body.id && body.rawText) {
      clauses = [body as Clause];
    } else {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Invalid request body. Expected { document: ParsedDocument } or { clauses: Clause[] }.',
        },
        { status: 400 }
      );
    }

    if (clauses.length === 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'No clauses provided for simplification and verification.',
        },
        { status: 400 }
      );
    }

    const language = body.language === 'hi' ? 'hi' : body.language === 'kn' ? 'kn' : 'en';

    // Run the batched 2-call pipeline
    const { analyzedClauses, apiCallsCount } = await simplifyClausesBatched(clauses, language);

    const verifiedCount = analyzedClauses.filter((c) => c.analysis.verification.status === 'verified').length;
    const needsReviewCount = analyzedClauses.filter((c) => c.analysis.verification.status === 'needs_review').length;
    const highRiskCount = analyzedClauses.filter((c) => c.analysis.risk.severity === 'high').length;

    return NextResponse.json({
      status: 'success',
      data: {
        documentId,
        analyzedClauses,
        summary: {
          totalClauses: analyzedClauses.length,
          verifiedCount,
          needsReviewCount,
          highRiskCount,
          apiCallsCount,
        },
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json(
      {
        status: 'error',
        message: `Simplification pipeline failed: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

