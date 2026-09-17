import { NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';

export async function GET() {
  try {
    const ai = getGeminiClient();
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    const response = await ai.models.generateContent({
      model,
      contents: 'Reply with exactly one word: OK',
    });

    const text = response.text ? response.text.trim() : '';

    return NextResponse.json({
      status: 'ok',
      text,
      model,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        status: 'error',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
