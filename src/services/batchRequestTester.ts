import config from "../constants/config";
import { debug, info } from "../utils/logger";
import type { HealthyRpc } from "../types";

const { CONCURRENCY, TIMEOUT_MS, MAX_RETRIES, RETRY_DELAY_MS, BATCH_SIZES } = config.BATCH_TESTER;

const FINE_SEARCH_PRECISION = 2;

type BatchOutcome = { ok: true } | { ok: false; error: string } | "rate_limited";

function buildBatchPayload(size: number): object[] {
  return Array.from({ length: size }, (_, i) => ({
    jsonrpc: "2.0",
    method: "eth_blockNumber",
    params: [],
    id: i + 1,
  }));
}

async function testBatchOfSize(
  url: string,
  size: number,
  timeoutMs: number,
): Promise<BatchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBatchPayload(size)),
      signal: controller.signal,
    });

    if (response.status === 429) {
      return "rate_limited";
    }

    if (!response.ok) {
      debug(
        `Error response from ${url} for batch size ${size}: ${response.status} ${response.statusText}`,
      );
      return { ok: false, error: `HTTP ${response.status} ${response.statusText}` };
    }

    const body = await response.json();
    if (!Array.isArray(body)) return { ok: false, error: "Response is not an array" };
    if (body.length !== size)
      return { ok: false, error: `Expected ${size} items, got ${body.length}` };

    const failedItem = body.find((item: { error?: unknown }) => item.error !== undefined);
    if (failedItem) return { ok: false, error: `Item error: ${JSON.stringify(failedItem.error)}` };

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

async function tryBatchWithRetries(
  url: string,
  size: number,
  timeoutMs: number,
  maxRetries: number,
  retryDelayMs: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let lastError = "Unknown error";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await testBatchOfSize(url, size, timeoutMs);

    if (result !== "rate_limited" && result.ok) return { ok: true };

    if (result !== "rate_limited" && result.ok === false) {
      if (attempt < maxRetries) return { ok: false, error: result.error };
      lastError = result.error;
    } else if (result === "rate_limited") {
      lastError = "Rate limited (HTTP 429)";
      if (attempt < maxRetries) {
        const backoffDelay = retryDelayMs * Math.pow(2, attempt);
        debug(`Rate limited on ${url}, retrying in ${backoffDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }

  return { ok: false, error: lastError };
}

async function findMaxBatchSize(
  url: string,
  sizes: number[],
  timeoutMs: number,
  maxRetries: number,
  retryDelayMs: number,
): Promise<{ maxSize: number; error: string }> {
  const sorted = [...sizes].sort((a, b) => a - b);

  const trySize = (size: number) =>
    tryBatchWithRetries(url, size, timeoutMs, maxRetries, retryDelayMs);

  // Quick check: if smallest size fails, batch is unsupported
  const minResult = await trySize(sorted[0]);
  if (minResult.ok === false) {
    return { maxSize: 0, error: minResult.error };
  }

  // Coarse binary search over predefined sizes
  let lo = 0;
  let hi = sorted.length - 1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if ((await trySize(sorted[mid])).ok) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const coarseIdx = Math.max(0, lo - 1);

  // If the largest predefined size works, return it
  if (coarseIdx >= sorted.length - 1) {
    return { maxSize: sorted[sorted.length - 1], error: "" };
  }

  // Fine binary search between sorted[coarseIdx] and sorted[coarseIdx + 1]
  let loBound = sorted[coarseIdx];
  let hiBound = sorted[coarseIdx + 1];

  while (hiBound - loBound > FINE_SEARCH_PRECISION) {
    const mid = Math.floor((loBound + hiBound) / 2);
    if ((await trySize(mid)).ok) {
      loBound = mid;
    } else {
      hiBound = mid;
    }
  }

  return { maxSize: loBound, error: "" };
}

export async function testBatchSupport(
  inputHealthyRpcs: Map<string, HealthyRpc[]>,
): Promise<{ healthyRpcs: Map<string, HealthyRpc[]>; rpcErrors: Map<string, string> }> {
  const filtered = Array.from(
    inputHealthyRpcs,
    ([chainId, rpcs]) => [chainId, rpcs.map(rpc => ({ ...rpc }) as HealthyRpc)] as const,
  ).filter(
    ([chainId]) =>
      config.WHITELISTED_CHAIN_IDS.length === 0 ||
      config.WHITELISTED_CHAIN_IDS.includes(parseInt(chainId, 10)),
  );

  const healthyRpcs = new Map(filtered);
  const rpcErrors = new Map<string, string>();

  const queue: HealthyRpc[] = [];
  for (const rpcs of healthyRpcs.values()) {
    for (const rpc of rpcs) {
      queue.push(rpc);
    }
  }

  if (queue.length === 0) {
    info("No RPCs to test for batch support");
    return { healthyRpcs, rpcErrors };
  }

  info(`Testing batch support for ${queue.length} RPCs with concurrency ${CONCURRENCY}`);

  let activeCount = 0;
  let processedCount = 0;
  const items = [...queue];

  await new Promise<void>(resolve => {
    function processNext(): void {
      if (items.length === 0 && activeCount === 0) {
        info(`Batch support testing complete: ${processedCount} RPCs processed`);
        resolve();
        return;
      }

      while (activeCount < CONCURRENCY && items.length > 0) {
        const rpc = items.shift()!;
        activeCount++;

        findMaxBatchSize(rpc.url, BATCH_SIZES, TIMEOUT_MS, MAX_RETRIES, RETRY_DELAY_MS)
          .then(({ maxSize, error }) => {
            rpc.maxBatchSize = maxSize;
            if (error) rpcErrors.set(rpc.url, error);
            debug(`${rpc.url} max batch size: ${maxSize}`);
          })
          .catch(err => {
            rpc.maxBatchSize = 0;
            rpcErrors.set(rpc.url, String(err));
            debug(`Batch test failed for ${rpc.url}: ${err}`);
          })
          .finally(() => {
            activeCount--;
            processedCount++;

            const threshold = Math.max(1, Math.floor(queue.length / 10));
            if (processedCount % threshold === 0) {
              const pct = Math.round((processedCount / queue.length) * 100);
              info(`Batch support progress: ${pct}% (${processedCount}/${queue.length})`);
            }

            processNext();
          });
      }
    }

    processNext();
  });

  return { healthyRpcs, rpcErrors };
}
