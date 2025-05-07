import http from "http";
import https from "https";
import config from "../constants/config";
import { debug, info, warn, error } from "../utils/logger";
import {
  HealthyRpc,
  JsonRpcResponse,
  NodeFetchOptions,
  RpcEndpoint,
  RpcTestResult,
  RpcTestStepResult,
} from "../types";

// Create persistent HTTP agents for better performance
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

// Track active requests for debugging purposes
type EndpointStatus = {
  url: string;
  chainId: string;
  startTime: number;
  currentStage: "chainId" | "blockNumber" | "getLogs" | "waiting";
  attempt: number;
  maxRetries: number;
  retryAfter: number | null;
  waiting: boolean;
  waitUntil: number | null;
};

const activeRequests = new Map<string, EndpointStatus>();

/**
 * Prints a summary of active requests for debugging
 */
function logActiveTasks() {
  if (activeRequests.size === 0) return;

  const now = Date.now();
  const statusList = Array.from(activeRequests.values());

  // Sort by duration (longest first)
  statusList.sort((a, b) => {
    const aDuration = now - a.startTime;
    const bDuration = now - b.startTime;
    return bDuration - aDuration;
  });

  debug(`---------- ACTIVE TASK STATUS (${activeRequests.size} endpoints) ----------`);

  const waitingTasks = statusList.filter(s => s.waiting);
  const processingTasks = statusList.filter(s => !s.waiting);

  if (processingTasks.length > 0) {
    debug(`PROCESSING TASKS (${processingTasks.length}):`);
    processingTasks.forEach(status => {
      const duration = (now - status.startTime) / 1000;
      debug(
        `- ${status.url} (${status.chainId}): stage=${status.currentStage}, attempt=${status.attempt}/${status.maxRetries + 1}, duration=${duration.toFixed(1)}s`,
      );
    });
  }

  if (waitingTasks.length > 0) {
    debug(`WAITING TASKS (${waitingTasks.length}):`);
    waitingTasks.forEach(status => {
      const duration = (now - status.startTime) / 1000;
      const remainingWait = status.waitUntil ? (status.waitUntil - now) / 1000 : 0;
      debug(
        `- ${status.url} (${status.chainId}): waiting=${remainingWait.toFixed(1)}s remaining, total duration=${duration.toFixed(1)}s, retryAfter=${status.retryAfter ? (status.retryAfter / 1000).toFixed(1) + "s" : "N/A"}`,
      );
    });
  }

  debug(`-----------------------------------------------------------------`);
}

// Set up periodic logging of active requests
const LOG_INTERVAL_MS = 10000; // Log active requests every 10 seconds
setInterval(logActiveTasks, LOG_INTERVAL_MS);

// Set up a safety timeout for stuck endpoints
const ENDPOINT_MAX_DURATION_MS = 120000; // 2 minutes max per endpoint
setInterval(() => {
  const now = Date.now();
  activeRequests.forEach((status, url) => {
    const duration = now - status.startTime;
    if (duration > ENDPOINT_MAX_DURATION_MS) {
      error(
        `Endpoint ${url} has been active for ${duration / 1000}s, exceeding the maximum allowed time. Marking as failed.`,
      );
      // Force the endpoint to be marked as failed by removing it from tracking
      activeRequests.delete(url);
    }
  });
}, 30000); // Check every 30 seconds

/**
 * Utility function to pause execution for the specified duration
 */
async function delay(ms: number, endpoint: RpcEndpoint): Promise<void> {
  // Update status to waiting mode
  const status = activeRequests.get(endpoint.url);
  if (status) {
    status.waiting = true;
    status.waitUntil = Date.now() + ms;
  }

  debug(`[RPC:${endpoint.url}] Starting delay of ${ms}ms`);

  return new Promise(resolve => {
    setTimeout(() => {
      // Update status when wait is complete
      const status = activeRequests.get(endpoint.url);
      if (status) {
        status.waiting = false;
        status.waitUntil = null;
      }
      debug(`[RPC:${endpoint.url}] Completed delay of ${ms}ms`);
      resolve();
    }, ms);
  });
}

/**
 * Handle retry-after logic and checks for timeout limits
 */
function handleRateLimit(
  endpoint: RpcEndpoint,
  retryAfter: number | null,
  currentDelay: number,
  method: string,
  attempt: number,
  maxRetries: number,
  maxRetryAfterTimeoutMs: number,
): { shouldContinue: boolean; delayMs: number | null } {
  const effectiveRetryAfter = retryAfter || currentDelay;

  // Update tracking with retry information
  const status = activeRequests.get(endpoint.url);
  if (status) {
    status.retryAfter = effectiveRetryAfter;
  }

  // Check if retry-after exceeds the maximum timeout
  if (effectiveRetryAfter > maxRetryAfterTimeoutMs) {
    debug(
      `[RPC:${endpoint.url}] Rate limited with retry-after value ${effectiveRetryAfter}ms which exceeds maximum timeout ${maxRetryAfterTimeoutMs}ms. Discarding endpoint.`,
    );
    return { shouldContinue: false, delayMs: null };
  }

  debug(
    `[RPC:${endpoint.url}] Rate limited during ${method} test, retrying in ${effectiveRetryAfter}ms (attempt ${attempt}/${maxRetries + 1})`,
  );

  return { shouldContinue: true, delayMs: effectiveRetryAfter };
}

/**
 * Handle normal retry logic for failed tests
 */
function handleTestFailure(
  endpoint: RpcEndpoint,
  method: string,
  currentDelay: number,
  attempt: number,
  maxRetries: number,
): { shouldContinue: boolean; delayMs: number } {
  debug(
    `[RPC:${endpoint.url}] ${method} test failed, retrying in ${currentDelay}ms (attempt ${attempt}/${maxRetries + 1})`,
  );

  // Update tracking with retry information
  const status = activeRequests.get(endpoint.url);
  if (status) {
    status.retryAfter = currentDelay;
  }

  return { shouldContinue: true, delayMs: currentDelay };
}
/**
 * Make a JSON-RPC request with consistent error handling
 */
async function makeRpcRequest(
  endpoint: RpcEndpoint,
  method: string,
  params: any[] = [],
): Promise<RpcTestStepResult> {
  // Update the current stage in tracking
  const status = activeRequests.get(endpoint.url);
  if (status) {
    status.currentStage =
      method === "eth_chainId"
        ? "chainId"
        : method === "eth_blockNumber"
          ? "blockNumber"
          : "getLogs";
  }

  const controller = new AbortController();

  // Create a hard timeout promise that will reject after the timeout
  // This ensures we don't get stuck even if AbortController doesn't work
  const timeoutMs = config.RPC_TESTER.HTTP_REQUEST_TIMEOUT_MS;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      controller.abort();
      reject(
        new Error(`Hard timeout after ${timeoutMs}ms for ${method} request to ${endpoint.url}`),
      );
    }, timeoutMs);
  });

  const start = Date.now();
  let retryAfter = null;

  debug(`[RPC:${endpoint.url}] Making ${method} request`);

  try {
    const options: NodeFetchOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
        id: 1,
      }),
      signal: controller.signal,
    };

    options.agent = endpoint.url.startsWith("https") ? httpsAgent : httpAgent;

    // Race the fetch against our hard timeout
    const response = await Promise.race([fetch(endpoint.url, options), timeoutPromise]);

    // Check if the request has been running too long, even if fetch didn't timeout
    if (Date.now() - start > timeoutMs) {
      controller.abort();
      throw new Error(`Request exceeded timeout of ${timeoutMs}ms but didn't abort properly`);
    }

    if (response.status === 429) {
      retryAfter = parseInt(response.headers.get("Retry-After") || "0", 10) * 1000 || null;
      debug(
        `[RPC:${endpoint.url}] Rate limited (status 429) for ${method}, Retry-After: ${retryAfter ? retryAfter + "ms" : "not specified"}`,
      );
      return {
        success: false,
        rateLimited: true,
        retryAfter,
      };
    }

    if (!response.ok) {
      debug(
        `[RPC:${endpoint.url}] Error response for ${method}: status=${response.status}, statusText="${response.statusText}"`,
      );
      return { success: false, rateLimited: false };
    }

    // Race the JSON parsing against a timeout too
    const jsonResult = await Promise.race([
      response.json() as Promise<JsonRpcResponse>,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`JSON parsing timeout for ${endpoint.url}`)), 5000),
      ),
    ]);

    const responseTime = Date.now() - start;

    debug(`[RPC:${endpoint.url}] ${method} response received in ${responseTime}ms`);

    return {
      success: true,
      jsonResult,
      responseTime,
    };
  } catch (err) {
    const errorMessage = err && typeof err.message === "string" ? err.message : "Unknown error";
    const statusCode = (err && err.status) || (err && err.cause && err.cause.code) || "N/A";
    const isAbortError = err && err.name === "AbortError";
    const responseTime = Date.now() - start;

    if (isAbortError || errorMessage.includes("timeout")) {
      error(
        `[RPC:${endpoint.url}] Request timeout for ${method} after ${responseTime}ms. Error: ${errorMessage}`,
      );
    } else {
      error(
        `[RPC:${endpoint.url}] Exception testing ${method}: status=${statusCode}, error="${errorMessage}"`,
      );
    }

    return {
      success: false,
      rateLimited: false,
      error: errorMessage,
      isTimeout: isAbortError || errorMessage.includes("timeout"),
    };
  }
}

/**
 * Tests the eth_chainId method of an RPC endpoint
 */
async function testChainId(endpoint: RpcEndpoint) {
  const result = await makeRpcRequest(endpoint, "eth_chainId");

  if (!result.success) {
    return result;
  }

  const { jsonResult, responseTime } = result;

  if (!jsonResult?.result || !/^0x[0-9A-Fa-f]+$/.test(jsonResult.result)) {
    debug(`[RPC:${endpoint.url}] Invalid chainId result: ${JSON.stringify(jsonResult.result)}`);
    return { success: false, rateLimited: false };
  }

  const returnedChainId = parseInt(jsonResult.result, 16).toString();
  debug(`[RPC:${endpoint.url}] eth_chainId response details: ${JSON.stringify(jsonResult)}`);

  return {
    success: true,
    chainId: returnedChainId,
    responseTime,
  };
}

/**
 * Tests the eth_blockNumber method of an RPC endpoint
 */
async function testBlockNumber(endpoint: RpcEndpoint) {
  const result = await makeRpcRequest(endpoint, "eth_blockNumber");

  if (!result.success) {
    return result;
  }

  const { jsonResult, responseTime } = result;

  if (!jsonResult?.result || !/^0x[0-9A-Fa-f]+$/.test(jsonResult.result)) {
    debug(`[RPC:${endpoint.url}] Invalid blockNumber result: ${JSON.stringify(jsonResult.result)}`);
    return { success: false, rateLimited: false };
  }

  const blockNumber = parseInt(jsonResult.result, 16);

  return {
    success: true,
    blockNumber,
    responseTime,
  };
}

/**
 * Tests the eth_getLogs method of an RPC endpoint
 */
async function testGetLogs(endpoint: RpcEndpoint, lastBlockNumber: number) {
  const fromBlock = Math.max(0, lastBlockNumber - 10);
  const toBlock = lastBlockNumber;

  const result = await makeRpcRequest(endpoint, "eth_getLogs", [
    {
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${toBlock.toString(16)}`,
    },
  ]);

  if (!result.success) {
    return result;
  }

  const { jsonResult, responseTime } = result;

  if (jsonResult.result === undefined) {
    debug(`[RPC:${endpoint.url}] Invalid eth_getLogs result: ${JSON.stringify(jsonResult.result)}`);
    return { success: false, rateLimited: false };
  }

  debug(`[RPC:${endpoint.url}] eth_getLogs returned ${jsonResult.result.length} logs`);

  return {
    success: true,
    responseTime,
  };
}

/**
 * Tests a single RPC endpoint with retry logic for rate limits
 */
async function testOneRpc(endpoint: RpcEndpoint): Promise<HealthyRpc | null> {
  let attempt = 0;
  const maxRetries = config.RPC_TESTER.MAX_RETRIES;
  const retryDelayMs = config.RPC_TESTER.RETRY_DELAY_MS;
  const exponentialBackoff = config.RPC_TESTER.EXPONENTIAL_BACKOFF || false;
  const maxRetryAfterTimeoutMs = config.RPC_TESTER.MAX_RETRY_AFTER_TIMEOUT_MS;

  // Add this endpoint to active tracking
  activeRequests.set(endpoint.url, {
    url: endpoint.url,
    chainId: endpoint.chainId,
    startTime: Date.now(),
    currentStage: "chainId",
    attempt: 1,
    maxRetries,
    retryAfter: null,
    waiting: false,
    waitUntil: null,
  });

  debug(`[RPC:${endpoint.url}] Starting RPC endpoint testing`);

  try {
    while (attempt <= maxRetries) {
      attempt++;

      // Update attempt in status tracking
      const status = activeRequests.get(endpoint.url);
      if (status) {
        status.attempt = attempt;
      }

      const currentDelay = exponentialBackoff
        ? retryDelayMs * Math.pow(2, attempt - 1)
        : retryDelayMs;

      debug(`[RPC:${endpoint.url}] Test attempt ${attempt}/${maxRetries + 1}`);
      const testStart = Date.now();

      // Test chain ID
      const chainIdResult = await testChainId(endpoint);
      if (!chainIdResult.success) {
        let shouldRetry = true;
        let delayMs = currentDelay;

        if (chainIdResult.rateLimited && attempt <= maxRetries) {
          const result = handleRateLimit(
            endpoint,
            chainIdResult.retryAfter,
            currentDelay,
            "chainId",
            attempt,
            maxRetries,
            maxRetryAfterTimeoutMs,
          );

          shouldRetry = result.shouldContinue;
          delayMs = result.delayMs || 0;
        } else if (attempt <= maxRetries) {
          const result = handleTestFailure(endpoint, "chainId", currentDelay, attempt, maxRetries);
          shouldRetry = result.shouldContinue;
          delayMs = result.delayMs;
        } else {
          shouldRetry = false;
        }

        if (!shouldRetry) {
          debug(`[RPC:${endpoint.url}] All chainId test attempts failed`);
          return null;
        }

        await delay(delayMs, endpoint);
        continue;
      }

      const chainIdResponseTime = chainIdResult.responseTime;
      const returnedChainId = chainIdResult.chainId;
      debug(
        `[RPC:${endpoint.url}] chainId test successful: returned chainId ${returnedChainId} in ${chainIdResponseTime}ms`,
      );

      // Test block number
      const blockNumberResult = await testBlockNumber(endpoint);
      if (!blockNumberResult.success) {
        let shouldRetry = true;
        let delayMs = currentDelay;

        if (blockNumberResult.rateLimited && attempt <= maxRetries) {
          const result = handleRateLimit(
            endpoint,
            blockNumberResult.retryAfter,
            currentDelay,
            "blockNumber",
            attempt,
            maxRetries,
            maxRetryAfterTimeoutMs,
          );

          shouldRetry = result.shouldContinue;
          delayMs = result.delayMs || 0;
        } else if (attempt <= maxRetries) {
          const result = handleTestFailure(
            endpoint,
            "blockNumber",
            currentDelay,
            attempt,
            maxRetries,
          );
          shouldRetry = result.shouldContinue;
          delayMs = result.delayMs;
        } else {
          shouldRetry = false;
        }

        if (!shouldRetry) {
          debug(`[RPC:${endpoint.url}] All blockNumber test attempts failed`);
          return null;
        }

        await delay(delayMs, endpoint);
        continue;
      }

      const blockNumberResponseTime = blockNumberResult.responseTime;
      const lastBlockNumber = blockNumberResult.blockNumber;
      debug(
        `[RPC:${endpoint.url}] blockNumber test successful: returned block ${lastBlockNumber} in ${blockNumberResponseTime}ms`,
      );

      // Test getLogs
      const getLogsResult = await testGetLogs(endpoint, lastBlockNumber);
      if (!getLogsResult.success) {
        let shouldRetry = true;
        let delayMs = currentDelay;

        if (getLogsResult.rateLimited && attempt <= maxRetries) {
          const result = handleRateLimit(
            endpoint,
            getLogsResult.retryAfter,
            currentDelay,
            "getLogs",
            attempt,
            maxRetries,
            maxRetryAfterTimeoutMs,
          );

          shouldRetry = result.shouldContinue;
          delayMs = result.delayMs || 0;
        } else if (attempt <= maxRetries) {
          const result = handleTestFailure(endpoint, "getLogs", currentDelay, attempt, maxRetries);
          shouldRetry = result.shouldContinue;
          delayMs = result.delayMs;
        } else {
          shouldRetry = false;
        }

        if (!shouldRetry) {
          debug(`[RPC:${endpoint.url}] All getLogs test attempts failed`);
          return null;
        }

        await delay(delayMs, endpoint);
        continue;
      }

      const getLogsResponseTime = getLogsResult.responseTime;
      debug(`[RPC:${endpoint.url}] getLogs test successful: completed in ${getLogsResponseTime}ms`);

      const totalResponseTime = chainIdResponseTime + blockNumberResponseTime + getLogsResponseTime;
      const totalTestTime = Date.now() - testStart;

      debug(
        `[RPC:${endpoint.url}] All tests passed successfully in ${totalTestTime}ms (response times: chainId=${chainIdResponseTime}ms, blockNumber=${blockNumberResponseTime}ms, getLogs=${getLogsResponseTime}ms, total=${totalResponseTime}ms)`,
      );

      // Remove from active tracking as we're done with this endpoint
      activeRequests.delete(endpoint.url);

      return {
        chainId: endpoint.chainId,
        url: endpoint.url,
        responseTime: totalResponseTime,
        returnedChainId,
        source: endpoint.source,
        lastBlockNumber,
      };
    }

    debug(`[RPC:${endpoint.url}] Exhausted all retry attempts, endpoint test failed`);
    return null;
  } finally {
    // Ensure endpoint is removed from tracking, even if an exception occurs
    activeRequests.delete(endpoint.url);
  }
}

/**
 * Tests a collection of RPC endpoints with efficient concurrency
 */
export async function testRpcEndpoints(endpoints: RpcEndpoint[]): Promise<RpcTestResult> {
  const concurrency = config.RPC_TESTER.HTTP_REQUEST_CONCURRENCY;
  const healthy: HealthyRpc[] = [];
  const queue = [...endpoints];
  let activeCount = 0;
  const chainIdMap = new Map<string, Set<string>>();

  // Set global timeout for the entire process
  const GLOBAL_TIMEOUT_MS = config.RPC_TESTER.GLOBAL_TIMEOUT_MS || 900000; // Default 15 minutes
  const startTime = Date.now();
  const timeoutPromise = new Promise<RpcTestResult>(resolve => {
    setTimeout(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      error(
        `Global timeout of ${GLOBAL_TIMEOUT_MS / 1000}s reached after processing ${healthy.length}/${endpoints.length} endpoints`,
      );

      // Log information about remaining active endpoints
      if (activeRequests.size > 0) {
        error(`${activeRequests.size} endpoints still active at timeout:`);
        activeRequests.forEach(status => {
          const duration = (Date.now() - status.startTime) / 1000;
          error(
            `- ${status.url}: stage=${status.currentStage}, attempt=${status.attempt}/${status.maxRetries + 1}, duration=${duration.toFixed(1)}s, waiting=${status.waiting}`,
          );
        });
      }

      // Return partial results
      resolve({
        healthyRpcs: healthy,
        chainIdMismatches: new Map(),
        incomplete: true,
      });
    }, GLOBAL_TIMEOUT_MS);
  });

  debug(
    `Starting RPC endpoint testing for ${endpoints.length} endpoints with concurrency ${concurrency}, global timeout ${GLOBAL_TIMEOUT_MS / 1000}s`,
  );

  // Set up periodic status logging for queue progress
  const queueStatusInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const remaining = queue.length;
    const completed = endpoints.length - remaining - activeCount;
    const percent = Math.floor((completed / endpoints.length) * 100);

    info(
      `Progress: ${percent}% (${completed}/${endpoints.length}) complete, ${activeCount} active, ${remaining} queued, elapsed ${elapsed.toFixed(0)}s`,
    );

    // Log the first few URLs still in the queue
    if (remaining > 0) {
      const queuePreview = queue.slice(0, Math.min(5, remaining));
      debug(
        `Queue preview (${remaining} total): ${queuePreview.map(e => e.url).join(", ")}${remaining > 5 ? "..." : ""}`,
      );
    }

    // Detailed active request logging is handled by the other interval
  }, 30000); // Log every 30 seconds

  const testPromise = new Promise<RpcTestResult>(resolve => {
    function processNext() {
      // Every 5th call, log queue status for debugging
      if (Math.random() < 0.2) {
        const completed = endpoints.length - queue.length - activeCount;
        const percent = Math.floor((completed / endpoints.length) * 100);
        debug(
          `Queue status: ${percent}% complete, ${activeCount} active, ${queue.length} remaining`,
        );
      }

      if (queue.length === 0 && activeCount === 0) {
        clearInterval(queueStatusInterval);
        debug(`RPC testing completed: ${healthy.length}/${endpoints.length} endpoints healthy`);

        const validatedRpcs = new Array<HealthyRpc>();
        const chainIdMismatchMap = new Map<string, string[]>();

        const rpcsByChain = new Map<string, HealthyRpc[]>();
        healthy.forEach(rpc => {
          if (!rpcsByChain.has(rpc.chainId)) {
            rpcsByChain.set(rpc.chainId, []);
          }
          rpcsByChain.get(rpc.chainId)!.push(rpc);
        });

        debug(`Validating chainIds for ${rpcsByChain.size} chains`);

        rpcsByChain.forEach((rpcs, expectedChainId) => {
          debug(`Chain ${expectedChainId}: Validating ${rpcs.length} healthy RPC endpoints`);

          const chainIdCounts = new Map<string, number>();
          rpcs.forEach(rpc => {
            const count = chainIdCounts.get(rpc.returnedChainId) || 0;
            chainIdCounts.set(rpc.returnedChainId, count + 1);
          });

          let dominantChainId = expectedChainId;
          let maxCount = 0;

          chainIdCounts.forEach((count, chainId) => {
            debug(`Chain ${expectedChainId}: ${count} endpoints returned chainId ${chainId}`);
            if (count > maxCount) {
              maxCount = count;
              dominantChainId = chainId;
            }
          });

          if (dominantChainId !== expectedChainId) {
            warn(
              `Chain ID mismatch for chain ${expectedChainId}: Most RPC endpoints (${maxCount}) returned ${dominantChainId}`,
            );
            chainIdMismatchMap.set(expectedChainId, [dominantChainId]);
          }

          rpcs.forEach(rpc => {
            if (rpc.returnedChainId === dominantChainId) {
              validatedRpcs.push(rpc);
              debug(
                `RPC ${rpc.url} validated for chain ${expectedChainId} with correct chainId ${dominantChainId}`,
              );
            } else {
              const mismatches = chainIdMismatchMap.get(expectedChainId) || [];
              if (!mismatches.includes(rpc.returnedChainId)) {
                mismatches.push(rpc.returnedChainId);
                chainIdMismatchMap.set(expectedChainId, mismatches);
              }
              warn(
                `RPC ${rpc.url} returned chain ID ${rpc.returnedChainId} when ${dominantChainId} was expected`,
              );
            }
          });
        });

        info(
          `RPC validation complete: ${validatedRpcs.length} valid endpoints, ${chainIdMismatchMap.size} chains with mismatches`,
        );

        resolve({
          healthyRpcs: validatedRpcs,
          chainIdMismatches: chainIdMismatchMap,
        });
        return;
      }

      while (queue.length > 0 && activeCount < concurrency) {
        const endpoint = queue.shift()!;
        activeCount++;

        debug(
          `Testing endpoint: ${endpoint.url} (active: ${activeCount}, queued: ${queue.length})`,
        );

        testOneRpc(endpoint)
          .then(result => {
            if (result) {
              debug(
                `Endpoint ${endpoint.url} test successful: chainId=${result.returnedChainId}, responseTime=${result.responseTime}ms`,
              );

              if (!chainIdMap.has(result.chainId)) {
                chainIdMap.set(result.chainId, new Set());
              }
              chainIdMap.get(result.chainId)!.add(result.returnedChainId);

              healthy.push(result);
            } else {
              debug(`Endpoint ${endpoint.url} test failed`);
            }
          })
          .catch(err => {
            const statusCode = err.status || (err.cause && err.cause.code) || "N/A";
            error(
              `Unexpected error testing endpoint ${endpoint.url}: status code: ${statusCode}, error: ${err}`,
            );
          })
          .finally(() => {
            activeCount--;
            processNext();
          });
      }
    }

    processNext();
  });

  // Race between normal completion and timeout
  return Promise.race([testPromise, timeoutPromise]);
}
