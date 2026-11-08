import { HttpError } from './http';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface ChatOptions {
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
  json?: boolean;
}

export async function groqChat(o: ChatOptions): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new HttpError(500, 'The server is missing GROQ_API_KEY');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: o.system },
        { role: 'user', content: o.user },
      ],
      temperature: o.temperature ?? 0.2,
      max_tokens: o.maxTokens,
      ...(o.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new HttpError(429, 'The AI service is rate-limited, retrying shortly', res.headers.get('retry-after') ?? '10');
    }
    let detail = '';
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      detail = data.error?.message ?? '';
    } catch {
      // ignore body parse errors
    }
    throw new HttpError(502, `AI service error (${res.status}). ${detail}`.trim());
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new HttpError(502, 'The AI service returned an empty response');
  return content;
}
