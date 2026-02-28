const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string = "request"
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const status = err?.response?.status ?? err?.status;
      const isRetryable = status === 502 || status === 503 || status === 504 || status === 429
        || err?.code === "ECONNRESET" || err?.code === "ETIMEDOUT";

      if (!isRetryable || attempt === MAX_RETRIES) {
        throw err;
      }

      const delay = BASE_DELAY_MS * attempt;
      console.log(`[retry] ${label} attempt ${attempt}/${MAX_RETRIES} failed (${status ?? err?.code}), retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
