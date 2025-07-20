import http from "http";
import https from "https";
import config from "../constants/config";
import { debug, error, info, warn } from "../utils/logger";
import type { HealthyRpc, RpcEndpoint, RpcTestResult } from "../types";

// Keep-alive agents for connection reuse
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

/**
 * Custom error types for better error handling
 */
class RpcTestError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "RpcTestError";
  }
}

class RpcTimeoutError extends RpcTestError {
  constructor(endpoint: string, timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`, endpoint);
    this.name = "RpcTimeoutError";
  }
}

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
        agent,
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

      const responseBody = await response.json();

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
      };
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

  // Group RPCs by expected chain ID
  for (const rpc of healthyRpcs) {
    const existing = chainGroups.get(rpc.chainId) || [];
    existing.push(rpc);
    chainGroups.set(rpc.chainId, existing);
  }

  const finalResults = new Map<string, HealthyRpc[]>();

  // Process each chain group
  for (const [expectedChainId, rpcs] of chainGroups) {
    if (rpcs.length === 0) continue;

    // Count returned chain IDs to find the dominant one
    const returnedChainCounts = new Map<string, number>();
    for (const rpc of rpcs) {
      const count = returnedChainCounts.get(rpc.returnedChainId) || 0;
      returnedChainCounts.set(rpc.returnedChainId, count + 1);
    }

    // Find the most common returned chain ID
    const dominantChainId = Array.from(returnedChainCounts.entries()).reduce(
      (best, [chainId, count]) => (count > best.count ? { chainId, count } : best),
      { chainId: expectedChainId, count: 0 },
    ).chainId;

    // Track mismatches
    if (dominantChainId !== expectedChainId) {
      warn(`Chain ${expectedChainId}: majority returned ${dominantChainId}`);
      chainIdMismatches.set(expectedChainId, [dominantChainId]);
    }

    // Filter RPCs matching the dominant chain ID
    const validRpcs = rpcs.filter(rpc => {
      if (rpc.returnedChainId === dominantChainId) {
        return true;
      }

      // Track additional mismatches
      const mismatches = chainIdMismatches.get(expectedChainId) || [];
      if (!mismatches.includes(rpc.returnedChainId)) {
        mismatches.push(rpc.returnedChainId);
        chainIdMismatches.set(expectedChainId, mismatches);
      }

      return false;
    });

    // Sort by response time (fastest first)
    validRpcs.sort((a, b) => a.responseTime - b.responseTime);

    if (validRpcs.length > 0) {
      finalResults.set(expectedChainId, validRpcs);
    }
  }

  return {
    healthyRpcs: finalResults,
    chainIdMismatches,
  };
}

/**
 * Test multiple RPC endpoints with controlled concurrency
 */
export async function testRpcEndpoints(endpoints: RpcEndpoint[]): Promise<RpcTestResult> {
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

        testSingleEndpoint(endpoint, testConfig)
          .then(result => {
            if (result) {
              healthyRpcs.push(result);
            }
          })
          .catch(err => {
            debug(`Test failed for ${endpoint.url}: ${err.message}`);
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
