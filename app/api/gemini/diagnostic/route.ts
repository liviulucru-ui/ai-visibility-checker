import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function diagnostic(error: unknown) {
  const candidate = error as { status?: number; statusCode?: number; statusText?: string; message?: string; code?: string; responseBody?: unknown }
  let providerMessage = candidate.message ?? 'Unknown Gemini provider error.'
  let providerCode = candidate.code
  if (typeof candidate.responseBody === 'string') {
    try {
      const parsed = JSON.parse(candidate.responseBody) as { error?: { code?: number; message?: string; status?: string } }
      providerCode = providerCode ?? parsed.error?.status ?? (parsed.error?.code ? String(parsed.error.code) : undefined)
      providerMessage = parsed.error?.message ?? providerMessage
    } catch {}
  }
  return {
    reachedGemini: Boolean(candidate.status || candidate.statusCode || candidate.responseBody),
    httpStatus: candidate.statusCode ?? candidate.status ?? null,
    statusText: candidate.statusText ?? null,
    providerCode: providerCode ?? null,
    providerMessage: providerMessage.slice(0, 500),
    model: 'gemini-3.6-flash',
  }
}

export async function GET() {
  const key = process.env.GEMINI_API_KEY_2
  if (!key) return NextResponse.json({ runtime: 'UNAVAILABLE', minimalRequest: 'FAILED', reason: 'GEMINI_API_KEY_2 is unavailable to the running server process.', model: 'gemini-3.6-flash' }, { status: 503 })
  try {
    const response = await generateText({
      model: createGoogleGenerativeAI({ apiKey: key })('gemini-3.6-flash'),
      temperature: 0,
      maxOutputTokens: 16,
      prompt: 'Return exactly this JSON and nothing else: {"ok":true}',
    })
    return NextResponse.json({ runtime: 'AVAILABLE', minimalRequest: 'SUCCESS', model: 'gemini-3.6-flash', response: response.text.slice(0, 100) })
  } catch (error) {
    return NextResponse.json({ runtime: 'AVAILABLE', minimalRequest: 'FAILED', ...diagnostic(error) }, { status: 502 })
  }
}
