import config from "../constants/config";
import { debug, info, warn } from "../utils/logger";
import type { HealthyRpc } from "../types";

const { CONCURRENCY, TIMEOUT_MS, MAX_RETRIES, RETRY_DELAY_MS, BLOCK_RANGES } =
  config.GET_LOGS_TESTER;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const FINE_SEARCH_PRECISION = 10;

async function fetchBlockNumber(url: string, timeoutMs: number): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const body = (await response.json()) as { result?: string; error?: unknown };
    if (!body.result || typeof body.result !== "string") return null;

    return parseInt(body.result, 16);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function testGetLogsRange(
  url: string,
  fromBlock: number,
  toBlock: number,
  timeoutMs: number,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getLogs",
        params: [
          {
            fromBlock: `0x${fromBlock.toString(16)}`,
            toBlock: `0x${toBlock.toString(16)}`,
            address: ZERO_ADDRESS,
          },
        ],
        id: 1,
      }),
      signal: controller.signal,
    });

    if (response.status === 429) return false;
    if (!response.ok) return false;

    const body = (await response.json()) as { result?: unknown; error?: unknown };
    return body.error === undefined;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function tryRangeWithRetries(
  url: string,
  range: number,
  currentBlock: number,
  timeoutMs: number,
  maxRetries: number,
  retryDelayMs: number,
): Promise<boolean> {
  const fromBlock = Math.max(0, currentBlock - range);
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const success = await testGetLogsRange(url, fromBlock, currentBlock, timeoutMs);
    if (success) return true;
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
  return false;
}

async function findMaxBlockDepth(
  url: string,
  currentBlock: number,
  ranges: number[],
  timeoutMs: number,
  maxRetries: number,
  retryDelayMs: number,
): Promise<number> {
  const sortedRanges = [...ranges].sort((a, b) => a - b);

  const tryRange = (range: number) =>
    tryRangeWithRetries(url, range, currentBlock, timeoutMs, maxRetries, retryDelayMs);

  // Quick check: if smallest range fails, eth_getLogs is unsupported
  if (!(await tryRange(sortedRanges[0]))) {
    return 0;
  }

  // Coarse binary search over predefined ranges to find bracket
  let lo = 0;
  let hi = sortedRanges.length - 1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (await tryRange(sortedRanges[mid])) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // hi = index of largest successful predefined range
  const coarseIdx = Math.max(0, lo - 1);

  // If the largest predefined range works, return it
  if (coarseIdx >= sortedRanges.length - 1) {
    return sortedRanges[sortedRanges.length - 1];
  }

  // Fine binary search between sortedRanges[coarseIdx] and sortedRanges[coarseIdx + 1]
  let loBound = sortedRanges[coarseIdx];
  let hiBound = sortedRanges[coarseIdx + 1];

  while (hiBound - loBound > FINE_SEARCH_PRECISION) {
    const mid = Math.floor((loBound + hiBound) / 2);
    if (await tryRange(mid)) {
      loBound = mid;
    } else {
      hiBound = mid;
    }
  }

  return loBound;
}

export async function testGetLogsBlockDepths(
  healthyRpcs: Map<string, HealthyRpc[]>,
): Promise<void> {
  const chainBlockNumbers = new Map<string, number>();

  // Fetch current block number for each chain
  for (const [chainId, rpcs] of healthyRpcs) {
    let blockNumber: number | null = null;
    for (const rpc of rpcs) {
      blockNumber = await fetchBlockNumber(rpc.url, TIMEOUT_MS);
      if (blockNumber !== null) break;
    }

    if (blockNumber !== null) {
      chainBlockNumbers.set(chainId, blockNumber);
    } else {
      warn(`Could not fetch block number for chain ${chainId}, skipping getLogs depth test`);
    }
  }

  // Build flat queue of RPCs to test
  const queue: { rpc: HealthyRpc; currentBlock: number }[] = [];
  for (const [chainId, rpcs] of healthyRpcs) {
    const currentBlock = chainBlockNumbers.get(chainId);
    if (currentBlock === undefined) {
      for (const rpc of rpcs) {
        rpc.getLogsBlockDepth = 0;
      }
      continue;
    }
    for (const rpc of rpcs) {
      queue.push({ rpc, currentBlock });
    }
  }

  if (queue.length === 0) {
    info("No RPCs to test for getLogs block depth");
    return;
  }

  info(`Testing getLogs block depth for ${queue.length} RPCs with concurrency ${CONCURRENCY}`);

  let activeCount = 0;
  let processedCount = 0;
  const items = [...queue];

  await new Promise<void>(resolve => {
    function processNext(): void {
      if (items.length === 0 && activeCount === 0) {
        info(`getLogs depth testing complete: ${processedCount} RPCs processed`);
        resolve();
        return;
      }

      while (activeCount < CONCURRENCY && items.length > 0) {
        const item = items.shift()!;
        activeCount++;

        findMaxBlockDepth(
          item.rpc.url,
          item.currentBlock,
          BLOCK_RANGES,
          TIMEOUT_MS,
          MAX_RETRIES,
          RETRY_DELAY_MS,
        )
          .then(depth => {
            item.rpc.getLogsBlockDepth = depth;
            debug(`${item.rpc.url} getLogs depth: ${depth}`);
          })
          .catch(err => {
            item.rpc.getLogsBlockDepth = 0;
            debug(`getLogs depth test failed for ${item.rpc.url}: ${err}`);
          })
          .finally(() => {
            activeCount--;
            processedCount++;

            const progressThreshold = Math.max(1, Math.floor(queue.length / 10));
            if (processedCount % progressThreshold === 0) {
              const percentage = Math.round((processedCount / queue.length) * 100);
              info(`getLogs depth progress: ${percentage}% (${processedCount}/${queue.length})`);
            }

            processNext();
          });
      }
    }

    processNext();
  });
}
