import { NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';
import { DEFAULT_MODEL_CASCADE } from '@/lib/models';

export async function GET() {
  try {
    const ai = getGeminiClient();
    let lastError: Error | null = null;
    let usedModel = '';
    let responseText = '';

    for (const model of DEFAULT_MODEL_CASCADE) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: 'Reply with exactly one word: OK',
        });
        const text = response.text ? response.text.trim() : '';
        if (text) {
          responseText = text;
          usedModel = model;
          break;
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
    }

    if (!responseText) {
      throw lastError || new Error('Failed to generate response with candidate models');
    }

    return NextResponse.json({
      status: 'ok',
      text: responseText,
      model: usedModel,
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
