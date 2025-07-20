import http from "http";
import https from "https";
import config from "../constants/config";
import { debug, error, info, warn } from "../utils/logger";
import type { HealthyRpc, RpcEndpoint, RpcTestResult } from "../types";
import { StatsCollector } from "../utils/StatsCollector";

// Keep-alive agents for connection reuse
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

/**
 * Configuration interface for better type safety
 */
interface RpcTestConfig {
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  concurrency: number;
}

/**
 * Get validated configuration with defaults
 */
function getTestConfig(): RpcTestConfig {
  const rpcConfig = config.RPC_TESTER;

  return {
    maxRetries: rpcConfig?.MAX_RETRIES ?? 2,
    retryDelayMs: rpcConfig?.RETRY_DELAY_MS ?? 1000,
    timeoutMs: rpcConfig?.HTTP_REQUEST_TIMEOUT_MS ?? 5000,
    concurrency: rpcConfig?.HTTP_REQUEST_CONCURRENCY ?? 10,
  };
}

/**
 * Promise timeout wrapper with proper cleanup
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Validate chain ID format and convert to decimal string
 */
function validateChainId(chainIdHex: unknown): string | null {
  if (typeof chainIdHex !== "string" || !/^0x[0-9A-Fa-f]+$/.test(chainIdHex)) {
    return null;
  }

  try {
    return parseInt(chainIdHex, 16).toString();
  } catch {
    return null;
  }
}

/**
 * Test a single RPC endpoint with retry logic
 */
async function testSingleEndpoint(
  endpoint: RpcEndpoint,
  testConfig: RpcTestConfig,
): Promise<HealthyRpc | null> {
  const { url, chainId, source } = endpoint;
  const { maxRetries, retryDelayMs, timeoutMs } = testConfig;
  const agent = url.startsWith("https") ? httpsAgent : httpAgent;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();
    const controller = new AbortController();

    try {
      const payload = JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
        id: 1,
      });

      const fetchPromise = fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: controller.signal,
      });

      const response = await withTimeout(fetchPromise, timeoutMs, () => controller.abort());

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        if (attempt < maxRetries) {
          const backoffDelay = retryDelayMs * Math.pow(2, attempt);
          debug(`Rate limited on ${url}, retrying in ${backoffDelay}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        }
        return null;
      }

      if (!response.ok) {
        debug(`HTTP ${response.status} from ${url}`);
        return null;
      }

      const responseBody = (await response.json()) as { result?: string; error?: any };

      if (!responseBody.result) {
        debug(`No result field from ${url}`);
        return null;
      }

      const returnedChainId = validateChainId(responseBody.result);
      if (!returnedChainId) {
        debug(`Invalid chainId from ${url}: ${responseBody.result}`);
        return null;
      }

      const responseTime = Date.now() - startTime;

      return {
        chainId,
        url,
        source,
        responseTime,
        returnedChainId,
        lastBlockNumber: 0, // TODO: Implement block number fetching
      } as HealthyRpc;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (attempt < maxRetries) {
        debug(`Attempt ${attempt + 1} failed for ${url}: ${errorMessage}`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        continue;
      }

      debug(`All attempts failed for ${url}: ${errorMessage}`);
      return null;
    }
  }

  return null;
}

/**
 * Group and validate RPC results by chain ID
 */
function processRpcResults(healthyRpcs: HealthyRpc[]): RpcTestResult {
  const chainGroups = new Map<string, HealthyRpc[]>();
  const chainIdMismatches = new Map<string, string[]>();

  // Group RPCs by expected chain ID and filter out mismatches
  for (const rpc of healthyRpcs) {
    // Only accept RPCs that returned the expected chain ID
    if (rpc.returnedChainId === rpc.chainId) {
      const existing = chainGroups.get(rpc.chainId) || [];
      existing.push(rpc);
      chainGroups.set(rpc.chainId, existing);
    } else {
      // Track the mismatch
      const mismatches = chainIdMismatches.get(rpc.chainId) || [];
      if (!mismatches.includes(rpc.returnedChainId)) {
        mismatches.push(rpc.returnedChainId);
        chainIdMismatches.set(rpc.chainId, mismatches);
      }
      debug(
        `Chain ID mismatch: expected ${rpc.chainId}, got ${rpc.returnedChainId} from ${rpc.url}`,
      );
    }
  }

  // Sort each chain's RPCs by response time (fastest first)
  const finalResults = new Map<string, HealthyRpc[]>();
  for (const [chainId, rpcs] of chainGroups) {
    rpcs.sort((a, b) => a.responseTime - b.responseTime);
    finalResults.set(chainId, rpcs);
  }

  return {
    healthyRpcs: finalResults,
    chainIdMismatches,
  };
}

/**
 * Test multiple RPC endpoints with controlled concurrency
 */
export async function testRpcEndpoints(
  endpoints: RpcEndpoint[],
  statsCollector?: StatsCollector,
): Promise<RpcTestResult> {
  if (endpoints.length === 0) {
    info("No endpoints to test");
    return {
      healthyRpcs: new Map(),
      chainIdMismatches: new Map(),
    };
  }

  const testConfig = getTestConfig();
  const { concurrency } = testConfig;

  info(`Testing ${endpoints.length} RPC endpoints with concurrency ${concurrency}`);

  const healthyRpcs: HealthyRpc[] = [];
  const queue = [...endpoints];
  let activeCount = 0;
  let processedCount = 0;

  return new Promise<RpcTestResult>((resolve, reject) => {
    function processNext(): void {
      // Check if we're done
      if (queue.length === 0 && activeCount === 0) {
        info(`Testing complete: ${healthyRpcs.length}/${endpoints.length} endpoints healthy`);

        try {
          const results = processRpcResults(healthyRpcs);
          const totalHealthy = Array.from(results.healthyRpcs.values()).reduce(
            (total, rpcs) => total + rpcs.length,
            0,
          );

          info(
            `Final results: ${totalHealthy} healthy RPCs across ${results.healthyRpcs.size} chains`,
          );
          resolve(results);
        } catch (err) {
          error(`Error processing RPC results: ${err}`);
          reject(err);
        }
        return;
      }

      // Start new tests up to concurrency limit
      while (activeCount < concurrency && queue.length > 0) {
        const endpoint = queue.shift()!;
        activeCount++;
        statsCollector?.recordTest();

        testSingleEndpoint(endpoint, testConfig)
          .then(result => {
            if (result) {
              healthyRpcs.push(result);
              statsCollector?.recordHealthy(result);
            } else {
              statsCollector?.recordUnhealthy(endpoint.chainId);
            }
          })
          .catch(err => {
            debug(`Test failed for ${endpoint.url}: ${err.message}`);
            statsCollector?.recordUnhealthy(endpoint.chainId);
          })
          .finally(() => {
            activeCount--;
            processedCount++;

            // Log progress every 10% or 50 endpoints
            const progressThreshold = Math.max(1, Math.floor(endpoints.length / 10));
            if (processedCount % progressThreshold === 0) {
              const percentage = Math.round((processedCount / endpoints.length) * 100);
              info(`Progress: ${percentage}% (${processedCount}/${endpoints.length})`);
            }

            processNext();
          });
      }
    }

    processNext();
  });
}

/**
 * Cleanup resources (call this when shutting down)
 */
export function cleanup(): void {
  httpAgent.destroy();
  httpsAgent.destroy();
}
