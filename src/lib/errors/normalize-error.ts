export type NormalizedError = { message: string; code?: string; details?: string; hint?: string; cause?: unknown };

export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof Error) return { message: error.message || 'Erro desconhecido.', cause: error.cause };
  if (typeof error === 'string') return { message: error };
  if (typeof error === 'object' && error !== null) {
    const value = error as Record<string, unknown>;
    return {
      message: typeof value.message === 'string' && value.message ? value.message : 'Erro desconhecido.',
      code: typeof value.code === 'string' ? value.code : undefined,
      details: typeof value.details === 'string' ? value.details : undefined,
      hint: typeof value.hint === 'string' ? value.hint : undefined,
      cause: error,
    };
  }
  return { message: 'Erro desconhecido.', cause: error };
}
