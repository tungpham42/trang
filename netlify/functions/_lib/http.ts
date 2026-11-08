export class HttpError extends Error {
  status: number;
  retryAfter?: string | null;

  constructor(status: number, message: string, retryAfter?: string | null) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function json(statusCode: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
}
