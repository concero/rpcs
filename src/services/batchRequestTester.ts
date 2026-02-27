import config from "../constants/config";
import { debug, info } from "../utils/logger";
import type { HealthyRpc } from "../types";

const { CONCURRENCY, TIMEOUT_MS, MAX_RETRIES, RETRY_DELAY_MS, BATCH_SIZES } =
  config.BATCH_TESTER;

const FINE_SEARCH_PRECISION = 2;

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
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBatchPayload(size)),
      signal: controller.signal,
    });

    if (!response.ok) return false;

    const body = await response.json();
    if (!Array.isArray(body)) return false;
    if (body.length !== size) return false;

    return body.every(
      (item: { error?: unknown }) => item.error === undefined,
    );
  } catch {
    return false;
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
): Promise<boolean> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (await testBatchOfSize(url, size, timeoutMs)) return true;
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
  return false;
}

async function findMaxBatchSize(
  url: string,
  sizes: number[],
  timeoutMs: number,
  maxRetries: number,
  retryDelayMs: number,
): Promise<number> {
  const sorted = [...sizes].sort((a, b) => a - b);

  const trySize = (size: number) =>
    tryBatchWithRetries(url, size, timeoutMs, maxRetries, retryDelayMs);

  // Quick check: if smallest size fails, batch is unsupported
  if (!(await trySize(sorted[0]))) {
    return 0;
  }

  // Coarse binary search over predefined sizes
  let lo = 0;
  let hi = sorted.length - 1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (await trySize(sorted[mid])) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const coarseIdx = Math.max(0, lo - 1);

  // If the largest predefined size works, return it
  if (coarseIdx >= sorted.length - 1) {
    return sorted[sorted.length - 1];
  }

  // Fine binary search between sorted[coarseIdx] and sorted[coarseIdx + 1]
  let loBound = sorted[coarseIdx];
  let hiBound = sorted[coarseIdx + 1];

  while (hiBound - loBound > FINE_SEARCH_PRECISION) {
    const mid = Math.floor((loBound + hiBound) / 2);
    if (await trySize(mid)) {
      loBound = mid;
    } else {
      hiBound = mid;
    }
  }

  return loBound;
}

export async function testBatchSupport(
  healthyRpcs: Map<string, HealthyRpc[]>,
): Promise<void> {
  const queue: HealthyRpc[] = [];
  for (const rpcs of healthyRpcs.values()) {
    for (const rpc of rpcs) {
      queue.push(rpc);
    }
  }

  if (queue.length === 0) {
    info("No RPCs to test for batch support");
    return;
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
          .then(maxSize => {
            rpc.maxBatchSize = maxSize;
            debug(`${rpc.url} max batch size: ${maxSize}`);
          })
          .catch(err => {
            rpc.maxBatchSize = 0;
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
}
