// =============================================================================
// Seller API calls — accept/reject, request payment, deliver.
// Includes retry logic for transient network/server errors.
// =============================================================================

import client from "../../lib/client.js";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function withApiRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const status = err?.response?.status;
      const isRetryable = !status || status >= 500 || status === 429;
      if (!isRetryable || attempt === MAX_RETRIES) break;
      console.log(`[sellerApi] ${label} failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }
  throw lastError!;
}

// -- Accept / Reject --

export interface AcceptOrRejectParams {
  accept: boolean;
  reason?: string;
}

export async function acceptOrRejectJob(
  jobId: number,
  params: AcceptOrRejectParams
): Promise<void> {
  console.log(
    `[sellerApi] acceptOrRejectJob  jobId=${jobId}  accept=${
      params.accept
    }  reason=${params.reason ?? "(none)"}`
  );

  await withApiRetry(
    () => client.post(`/acp/providers/jobs/${jobId}/accept`, params),
    `acceptOrRejectJob(${jobId})`
  );
}

// -- Payment request --

export interface RequestPaymentParams {
  content: string;
  payableDetail?: {
    amount: number;
    tokenAddress: string;
    recipient: string;
  };
}

export async function requestPayment(jobId: number, params: RequestPaymentParams): Promise<void> {
  await withApiRetry(
    () => client.post(`/acp/providers/jobs/${jobId}/requirement`, params),
    `requestPayment(${jobId})`
  );
}

// -- Deliver --

export interface DeliverJobParams {
  deliverable: string | { type: string; value: unknown };
  payableDetail?: {
    amount: number;
    tokenAddress: string;
  };
}

export async function deliverJob(jobId: number, params: DeliverJobParams): Promise<void> {
  const delivStr =
    typeof params.deliverable === "string"
      ? params.deliverable
      : JSON.stringify(params.deliverable);
  const transferStr = params.payableDetail
    ? `  transfer: ${params.payableDetail.amount} @ ${params.payableDetail.tokenAddress}`
    : "";
  console.log(`[sellerApi] deliverJob  jobId=${jobId}  deliverable=${delivStr}${transferStr}`);

  await withApiRetry(
    () => client.post(`/acp/providers/jobs/${jobId}/deliverable`, params),
    `deliverJob(${jobId})`
  );
}
