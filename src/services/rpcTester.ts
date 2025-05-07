import http from "http";
import https from "https";
import config from "../constants/config";
import { debug, info, warn } from "../utils/logger";
import {
  HealthyRpc,
  JsonRpcResponse,
  NodeFetchOptions,
  RpcEndpoint,
  RpcTestResult,
} from "../types";

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testOneRpc(endpoint: RpcEndpoint): Promise<HealthyRpc | null> {
  let attempt = 0;
  const maxRetries = config.RPC_TESTER.MAX_RETRIES;
  const retryDelayMs = config.RPC_TESTER.RETRY_DELAY_MS;

  debug(`Testing endpoint: ${endpoint.url}`);
  while (attempt <= maxRetries) {
    const start = Date.now();
    let chainIdResponseTime = 0;
    let getLogsResponseTime = 0;

    // Test chainId
    const chainIdResult = await testChainId(endpoint);
    if (!chainIdResult.success) {
      if (attempt < maxRetries) {
        await delay(retryDelayMs);
        attempt++;
        continue;
      }
      return null;
    }

    chainIdResponseTime = chainIdResult.responseTime;
    const returnedChainId = chainIdResult.chainId;

    // Test getLogs
    const getLogsResult = await testGetLogs(endpoint);
    if (!getLogsResult.success) {
      if (attempt < maxRetries) {
        await delay(retryDelayMs);
        attempt++;
        continue;
      }
      return null;
    }

    getLogsResponseTime = getLogsResult.responseTime;

    // Both tests passed
    const totalResponseTime = chainIdResponseTime + getLogsResponseTime;

    return {
      chainId: endpoint.chainId,
      url: endpoint.url,
      responseTime: totalResponseTime,
      returnedChainId,
      source: endpoint.source,
    };
  }
  return null;
}

async function testChainId(endpoint: RpcEndpoint) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.RPC_TESTER.HTTP_REQUEST_TIMEOUT_MS);

  const start = Date.now();

  try {
    const options: NodeFetchOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
        id: 1,
      }),
      signal: controller.signal,
    };

    options.agent = endpoint.url.startsWith("https") ? httpsAgent : httpAgent;
    const chainIdResponse = await fetch(endpoint.url, options);
    clearTimeout(timeoutId);

    if (chainIdResponse.status === 429) {
      debug(`Rate limited (status 429) for endpoint: ${endpoint.url}`);
      return { success: false };
    }

    if (!chainIdResponse.ok) {
      debug(
        `Error response for endpoint: ${endpoint.url}, status: ${chainIdResponse.status}, statusText: ${chainIdResponse.statusText}`,
      );
      return { success: false };
    }

    const chainIdJson = (await chainIdResponse.json()) as JsonRpcResponse;

    if (!chainIdJson?.result || !/^0x[0-9A-Fa-f]+$/.test(chainIdJson.result)) {
      debug(`Invalid chainId result from endpoint: ${endpoint.url}`);
      return { success: false };
    }

    const returnedChainId = parseInt(chainIdJson.result, 16).toString();
    return {
      success: true,
      chainId: returnedChainId,
      responseTime: Date.now() - start,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const errorMessage = err.message || "Unknown error";
    const statusCode = err.status || (err.cause && err.cause.code) || "N/A";

    debug(
      `Exception testing chainId for endpoint: ${endpoint.url}, status code: ${statusCode}, error: ${errorMessage}`,
    );
    return { success: false };
  }
}
async function testGetLogs(endpoint: RpcEndpoint) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.RPC_TESTER.HTTP_REQUEST_TIMEOUT_MS);

  const start = Date.now();

  try {
    // Use a small block range to minimize load on the RPC
    const options: NodeFetchOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getLogs",
        params: [
          {
            fromBlock: "0x1",
            toBlock: "0x2",
            address: [], // No address filter
            topics: [], // No topic filter
          },
        ],
        id: 2,
      }),
      signal: controller.signal,
    };

    options.agent = endpoint.url.startsWith("https") ? httpsAgent : httpAgent;
    const logsResponse = await fetch(endpoint.url, options);
    clearTimeout(timeoutId);

    if (logsResponse.status === 429) {
      debug(`Rate limited (status 429) for getLogs on endpoint: ${endpoint.url}`);
      return { success: false };
    }

    if (!logsResponse.ok) {
      debug(
        `Error response for getLogs on endpoint: ${endpoint.url}, status: ${logsResponse.status}, statusText: ${logsResponse.statusText}`,
      );
      return { success: false };
    }

    const logsJson = (await logsResponse.json()) as JsonRpcResponse;

    if (logsJson.error) {
      debug(
        `Error in getLogs response from endpoint: ${endpoint.url}, error: ${JSON.stringify(logsJson.error)}`,
      );
      return { success: false };
    }

    // We don't need to validate the actual logs content, just that the request was successful
    return {
      success: true,
      responseTime: Date.now() - start,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const errorMessage = err.message || "Unknown error";
    const statusCode = err.status || (err.cause && err.cause.code) || "N/A";

    debug(
      `Exception testing getLogs for endpoint: ${endpoint.url}, status code: ${statusCode}, error: ${errorMessage}`,
    );
    return { success: false };
  }
}

export async function testRpcEndpoints(endpoints: RpcEndpoint[]): Promise<RpcTestResult> {
  let concurrency = config.RPC_TESTER.HTTP_REQUEST_CONCURRENCY;
  const healthy: HealthyRpc[] = [];
  const queue = [...endpoints];
  let activeCount = 0;
  const chainIdMap = new Map<string, Set<string>>();

  return new Promise(resolve => {
    function processNext() {
      if (queue.length === 0 && activeCount === 0) {
        const validatedRpcs = new Array<HealthyRpc>();
        const chainIdMismatchMap = new Map<string, string[]>();

        const rpcsByChain = new Map<string, HealthyRpc[]>();
        healthy.forEach(rpc => {
          if (!rpcsByChain.has(rpc.chainId)) {
            rpcsByChain.set(rpc.chainId, []);
          }
          rpcsByChain.get(rpc.chainId)!.push(rpc);
        });

        rpcsByChain.forEach((rpcs, expectedChainId) => {
          const chainIdCounts = new Map<string, number>();
          rpcs.forEach(rpc => {
            const count = chainIdCounts.get(rpc.returnedChainId) || 0;
            chainIdCounts.set(rpc.returnedChainId, count + 1);
          });

          let dominantChainId = expectedChainId;
          let maxCount = 0;

          chainIdCounts.forEach((count, chainId) => {
            if (count > maxCount) {
              maxCount = count;
              dominantChainId = chainId;
            }
          });

          if (dominantChainId !== expectedChainId) {
            warn(
              `Chain ID mismatch for chain ${expectedChainId}: Most RPC endpoints returned ${dominantChainId}`,
            );
            chainIdMismatchMap.set(expectedChainId, [dominantChainId]);
          }
          rpcs.forEach(rpc => {
            if (rpc.returnedChainId === dominantChainId) {
              validatedRpcs.push(rpc);
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
          `Testing endpoint: ${endpoint.url} (active: ${activeCount}, remaining: ${queue.length})`,
        );

        testOneRpc(endpoint)
          .then(result => {
            if (result) {
              if (!chainIdMap.has(result.chainId)) {
                chainIdMap.set(result.chainId, new Set());
              }
              chainIdMap.get(result.chainId)!.add(result.returnedChainId);

              healthy.push(result);
            }
          })
          .catch(err => {
            const statusCode = err.status || (err.cause && err.cause.code) || "N/A";
            debug(
              `Error testing endpoint ${endpoint.url}: status code: ${statusCode}, error: ${err}`,
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
}
