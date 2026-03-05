import config from "../constants/config";
import { debug, info, warn } from "../utils/logger";
import type { HealthyRpc } from "../types";

const { CONCURRENCY, TIMEOUT_MS, MAX_RETRIES, RETRY_DELAY_MS, BLOCK_RANGES } = config.DEPTH_TESTER;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const FINE_SEARCH_PRECISION = 100;

type RangeTestResult = { ok: true } | { ok: false; error: string } | "rate_limited";

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
): Promise<RangeTestResult> {
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

    if (response.status === 429) {
      return "rate_limited";
    }

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status} ${response.statusText}` };
    }

    const body = (await response.json()) as { result?: unknown; error?: { message?: string } };
    if (body.error !== undefined) {
      return { ok: false, error: body.error.message ?? JSON.stringify(body.error) };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
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
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fromBlock = Math.max(0, currentBlock - range);
  let lastError = "Unknown error";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await testGetLogsRange(url, fromBlock, currentBlock, timeoutMs);

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

async function findMaxBlockDepth(
  url: string,
  currentBlock: number,
  ranges: number[],
  timeoutMs: number,
  maxRetries: number,
  retryDelayMs: number,
): Promise<{ maxDepth: number; error: string }> {
  const sortedRanges = [...ranges].sort((a, b) => a - b);

  const tryRange = (range: number) =>
    tryRangeWithRetries(url, range, currentBlock, timeoutMs, maxRetries, retryDelayMs);

  // Quick check: if smallest range fails, eth_getLogs is unsupported
  const minResult = await tryRange(sortedRanges[0]);
  if (minResult.ok === false) {
    return { maxDepth: 0, error: minResult.error };
  }

  // If the largest predefined range works, return it immediately
  const maxResult = await tryRange(sortedRanges[sortedRanges.length - 1]);
  if (maxResult.ok) {
    return { maxDepth: sortedRanges[sortedRanges.length - 1], error: "" };
  }

  // Coarse binary search over predefined ranges to find bracket
  let lo = 0;
  let hi = sortedRanges.length - 1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if ((await tryRange(sortedRanges[mid])).ok) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const coarseIdx = Math.max(0, lo - 1);

  // Fine binary search between sortedRanges[coarseIdx] and sortedRanges[coarseIdx + 1]
  let loBound = sortedRanges[coarseIdx];
  let hiBound = sortedRanges[coarseIdx + 1];

  while (hiBound - loBound > FINE_SEARCH_PRECISION) {
    const mid = Math.floor((loBound + hiBound) / 2);
    if ((await tryRange(mid)).ok) {
      loBound = mid;
    } else {
      hiBound = mid;
    }
  }

  return { maxDepth: loBound, error: "" };
}

export async function testGetLogsBlockDepths(
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
  const chainBlockNumbers = new Map<string, number>();

  // Fetch current block number for all chains in parallel
  await Promise.allSettled(
    Array.from(healthyRpcs.entries()).map(async ([chainId, rpcs]) => {
      for (const rpc of rpcs) {
        const blockNumber = await fetchBlockNumber(rpc.url, TIMEOUT_MS);
        if (blockNumber !== null) {
          chainBlockNumbers.set(chainId, blockNumber - 1000); // Gap for bad rpcs
          return;
        }
      }
      warn(`Could not fetch block number for chain ${chainId}, skipping getLogs depth test`);
    }),
  );

  // Build flat queue of RPCs to test
  const queue: { rpc: HealthyRpc; currentBlock: number }[] = [];
  for (const [chainId, rpcs] of healthyRpcs) {
    const currentBlock = chainBlockNumbers.get(chainId);
    if (currentBlock === undefined) {
      for (const rpc of rpcs) {
        rpc.getLogsBlockDepth = 0;
        rpcErrors.set(rpc.url, "Block number unavailable");
      }
      continue;
    }
    for (const rpc of rpcs) {
      queue.push({ rpc, currentBlock });
    }
  }

  if (queue.length === 0) {
    info("No RPCs to test for getLogs block depth");
    return { healthyRpcs, rpcErrors };
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
          .then(({ maxDepth, error }) => {
            item.rpc.getLogsBlockDepth = maxDepth;
            if (error) rpcErrors.set(item.rpc.url, error);
            debug(`${item.rpc.url} getLogs depth: ${maxDepth}`);
          })
          .catch(err => {
            item.rpc.getLogsBlockDepth = 0;
            rpcErrors.set(item.rpc.url, String(err));
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

  return { healthyRpcs, rpcErrors };
}
