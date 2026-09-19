import { NextRequest, NextResponse } from 'next/server';
import { ParsedDocument, CompareApiResponse } from '@/lib/types';
import { compareDocuments } from '@/lib/compare';

export async function POST(req: NextRequest): Promise<NextResponse<CompareApiResponse>> {
  try {
    const body = await req.json();
    const { documentA, documentB } = body as {
      documentA?: ParsedDocument;
      documentB?: ParsedDocument;
    };

    if (!documentA || !Array.isArray(documentA.clauses) || !documentB || !Array.isArray(documentB.clauses)) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Both documentA and documentB must be provided with valid clauses arrays.',
        },
        { status: 400 }
      );
    }

    if (documentA.clauses.length === 0 && documentB.clauses.length === 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Both documents are empty. Cannot compare documents without clauses.',
        },
        { status: 400 }
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

    return NextResponse.json(
      {
        status: 'error',
        message: `Comparison failed: ${errorMsg}`,
      },
      { status: 500 }
    );
  }
}
