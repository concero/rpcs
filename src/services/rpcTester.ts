import http from "http";
import https from "https";
import config from "../constants/config";
import { debug, warn } from "../utils/logger";
import { HealthyRpc, RpcEndpoint, RpcTestResult } from "../types";

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

interface JsonRpcResponse {
  jsonrpc: string;
  id: number | string;
  result?: string;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface NodeFetchOptions extends RequestInit {
  agent?: http.Agent | https.Agent;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testOneRpc(endpoint: RpcEndpoint): Promise<HealthyRpc | null> {
  let attempt = 0;
  const maxRetries = config.RPC_CHECKER_MAX_RETRIES;

  debug(`Testing endpoint: ${endpoint.url}`);
  while (attempt <= maxRetries) {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.RPC_REQUEST_TIMEOUT_MS);

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
        if (attempt < maxRetries) {
          await delay(config.RPC_CHECKER_RETRY_DELAY_MS);
          attempt++;
          continue;
        }
        return null;
      }

      if (!chainIdResponse.ok) {
        debug(
          `Error response for endpoint: ${endpoint.url}, status: ${chainIdResponse.status}, statusText: ${chainIdResponse.statusText}`,
        );
        return null;
      }

      const chainIdJson = (await chainIdResponse.json()) as JsonRpcResponse;

      if (!chainIdJson?.result || !/^0x[0-9A-Fa-f]+$/.test(chainIdJson.result)) {
        debug(`Invalid chainId result from endpoint: ${endpoint.url}`);
        return null;
      }

      const returnedChainId = parseInt(chainIdJson.result, 16).toString();

      return {
        chainId: endpoint.chainId,
        url: endpoint.url,
        responseTime: Date.now() - start,
        returnedChainId,
        source: endpoint.source,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const errorMessage = err.message || "Unknown error";
      const statusCode = err.status || (err.cause && err.cause.code) || "N/A";

      debug(
        `Exception testing endpoint: ${endpoint.url}, status code: ${statusCode}, error: ${errorMessage}`,
      );

      if (attempt < maxRetries) {
        await delay(config.RPC_CHECKER_RETRY_DELAY_MS);
        attempt++;
        continue;
      }
      return null;
    }
  }
  return null;
}

export async function testRpcEndpoints(endpoints: RpcEndpoint[]): Promise<RpcTestResult> {
  let concurrency = config.RPC_CHECKER_REQUEST_CONCURRENCY;
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
              // debug(
              //   `Endpoint healthy: ${endpoint.url} (response time: ${result.responseTime}ms, chain ID: ${result.returnedChainId})`,
              // );

              if (!chainIdMap.has(result.chainId)) {
                chainIdMap.set(result.chainId, new Set());
              }
              chainIdMap.get(result.chainId)!.add(result.returnedChainId);

              healthy.push(result);
            } else {
              // debug(`Endpoint unhealthy: ${endpoint.url}`);
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
