import http from "http";
import https from "https";
import config from "./constants/config";
import { debug } from "./logger";
import { HealthyRpc, RpcEndpoint } from "./types";

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testOneRpc(endpoint: RpcEndpoint): Promise<HealthyRpc | null> {
  let attempt = 0;
  const maxRetries = config.MAX_RETRIES;

  debug(`Testing endpoint: ${endpoint.url}`);
  while (attempt <= maxRetries) {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.RPC_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        }),
        signal: controller.signal,
        agent: endpoint.url.startsWith("https") ? httpsAgent : httpAgent,
      });
      debug(`${endpoint.url} response status: ${response.status}`);

      clearTimeout(timeoutId);

      if (response.status === 429) {
        if (attempt < maxRetries) {
          await delay(config.RETRY_DELAY_MS);
          attempt++;
          continue;
        }
        return null;
      }

      if (!response.ok) return null;

      const json = await response.json();
      if (json?.result && /^0x[0-9A-Fa-f]+$/.test(json.result)) {
        return {
          chainId: endpoint.chainId,
          url: endpoint.url,
          responseTime: Date.now() - start,
        };
      }
      return null;
    } catch (err) {
      clearTimeout(timeoutId);
      return null;
    }
  }
  return null;
}

export async function testRpcEndpoints(endpoints: RpcEndpoint[]): Promise<HealthyRpc[]> {
  let concurrency = config.CONCURRENCY_LIMIT;
  if (concurrency === 0) {
    concurrency = endpoints.length;
  } else if (!concurrency || concurrency < 0) {
    concurrency = 10;
  }

  const healthy: HealthyRpc[] = [];
  let i = 0;

  while (i < endpoints.length) {
    const remaining = endpoints.length - i;
    const batchSize = Math.min(concurrency, remaining);
    const slice = endpoints.slice(i, i + batchSize);

    debug(`Processing batch of ${slice.length} endpoints...`);
    const settled = await Promise.allSettled(slice.map(e => testOneRpc(e)));

    const successCount = settled.filter(s => s.status === "fulfilled" && s.value).length;
    debug(`Batch completed: ${successCount}/${slice.length} endpoints healthy`);

    for (const s of settled) {
      if (s.status === "fulfilled" && s.value) {
        healthy.push(s.value);
      }
    }
    i += batchSize;
  }

  return healthy;
}
