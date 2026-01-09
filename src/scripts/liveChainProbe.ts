import fs from "fs";
import path from "path";
import config from "../constants/config";
import {
  mergeChainlistRpcs,
  parseChainlistRpcs,
  fetchChainlistRpcs,
} from "../services/chainlistRpcs";
import { fetchChainlistExtraRpcs, parseChainlistExtraRpcs } from "../services/chainlistExtraRpcs";
import { ensureOutputDirectoryExists } from "../services/fileService";
import { RpcEndpoint } from "../types";
import { extractChainlistEndpoints } from "../utils/parsers";
import { debug, info, warn } from "../utils/logger";

type LiveChainResult = {
  chainId: string;
  chainName?: string;
  liveRpcCount: number;
  liveRpcs: Array<{
    url: string;
    source: RpcEndpoint["source"];
    responseTime?: number;
  }>;
};

type RpcProbeResult = {
  url: string;
  chainId: string;
  source: RpcEndpoint["source"];
  reachable: boolean;
  responseTime?: number;
  error?: string;
};

const REQUEST_TIMEOUT_MS = config.RPC_TESTER.HTTP_REQUEST_TIMEOUT_MS ?? 5_000;
const CONCURRENCY = config.RPC_TESTER.HTTP_REQUEST_CONCURRENCY ?? 25;
const OUTPUT_DIR = path.join(config.OUTPUT_DIR, "live-chains");

async function fetchEthereumListsAllChains(): Promise<Record<string, { name?: string; rpcs: string[] }>> {
  const response = await fetch(config.URLS.ETHEREUM_LISTS_CHAINS_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch ethereum-lists chains.json: ${response.status}`);
  }

  const chains = (await response.json()) as Array<{ name?: string; chainId?: number; rpc?: string[] }>;
  const result: Record<string, { name?: string; rpcs: string[] }> = {};

  chains.forEach(chain => {
    if (!chain.chainId || !Array.isArray(chain.rpc) || chain.rpc.length === 0) {
      return;
    }

    const chainId = chain.chainId.toString();
    const httpRpcs = chain.rpc.filter(url => typeof url === "string" && url.startsWith("http"));
    if (httpRpcs.length > 0) {
      result[chainId] = { name: chain.name, rpcs: httpRpcs };
    }
  });

  info(`Fetched ${Object.keys(result).length} chains from ethereum-lists`);
  return result;
}

async function collectAllEndpoints(): Promise<RpcEndpoint[]> {
  const [chainlistRaw, extraChainlistRaw, ethereumListsChains] = await Promise.all([
    fetchChainlistRpcs(),
    fetchChainlistExtraRpcs(),
    fetchEthereumListsAllChains(),
  ]);

  const primaryChainlist = parseChainlistRpcs(chainlistRaw);
  const extraChainlist = parseChainlistExtraRpcs(extraChainlistRaw);
  const mergedChainlist = mergeChainlistRpcs(primaryChainlist, extraChainlist);

  const chainlistEndpoints = extractChainlistEndpoints(mergedChainlist);
  const ethereumListEndpoints = Object.entries(ethereumListsChains).flatMap(([chainId, chain]) =>
    chain.rpcs.map(url => ({
      chainId,
      url,
      source: "ethereum-lists" as const,
    })),
  );

  const seen = new Set<string>();
  const unique: RpcEndpoint[] = [];

  [...chainlistEndpoints, ...ethereumListEndpoints].forEach(endpoint => {
    const key = `${endpoint.chainId}|${endpoint.url}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(endpoint);
  });

  info(
    `Collected ${unique.length} unique RPC endpoints from ChainList and EthereumLists (chainlist: ${chainlistEndpoints.length}, ethereum-lists: ${ethereumListEndpoints.length})`,
  );

  return unique;
}

async function probeRpcEndpoint(endpoint: RpcEndpoint): Promise<RpcProbeResult | null> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        url: endpoint.url,
        chainId: endpoint.chainId,
        source: endpoint.source,
        reachable: false,
        error: `HTTP ${response.status}`,
      };
    }

    const json = (await response.json()) as { result?: string; error?: unknown };
    if (json.error) {
      return {
        url: endpoint.url,
        chainId: endpoint.chainId,
        source: endpoint.source,
        reachable: false,
        error: json.error?.toString() || "Unknown error",
      };
    }

    const responseTime = Date.now() - startTime;
    return {
      url: endpoint.url,
      chainId: endpoint.chainId,
      source: endpoint.source,
      reachable: true,
      responseTime,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    debug(`Error probing ${endpoint.url}: ${message}`);
    return {
      url: endpoint.url,
      chainId: endpoint.chainId,
      source: endpoint.source,
      reachable: false,
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runProbes(endpoints: RpcEndpoint[]): Promise<RpcProbeResult[]> {
  const results: RpcProbeResult[] = [];
  let processed = 0;
  let index = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = index++;
      const endpoint = endpoints[currentIndex];
      if (!endpoint) break;

      const result = await probeRpcEndpoint(endpoint);
      if (result) {
        results.push(result);
      }

      processed++;
      if (processed % 50 === 0) {
        info(`Probed ${processed}/${endpoints.length} endpoints...`);
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  return results;
}

function buildLiveChainResults(
  probeResults: RpcProbeResult[],
  chainNames: Record<string, string | undefined>,
): LiveChainResult[] {
  const chainsMap = new Map<string, LiveChainResult>();

  // Process successful probes
  probeResults
    .filter(result => result.reachable)
    .forEach(result => {
      const existing = chainsMap.get(result.chainId);
      if (existing) {
        existing.liveRpcCount++;
        existing.liveRpcs.push({
          url: result.url,
          source: result.source,
          responseTime: result.responseTime,
        });
      } else {
        chainsMap.set(result.chainId, {
          chainId: result.chainId,
          chainName: chainNames[result.chainId],
          liveRpcCount: 1,
          liveRpcs: [{
            url: result.url,
            source: result.source,
            responseTime: result.responseTime,
          }],
        });
      }
    });

  // Convert to array and sort by chain ID
  return Array.from(chainsMap.values()).sort((a, b) =>
    parseInt(a.chainId) - parseInt(b.chainId)
  );
}

function writeResults(liveChains: LiveChainResult[], allProbeResults: RpcProbeResult[]) {
  ensureOutputDirectoryExists(OUTPUT_DIR);

  const liveChainsPath = path.join(OUTPUT_DIR, "live-chains.json");
  const allResultsPath = path.join(OUTPUT_DIR, "all-probe-results.json");
  const summaryPath = path.join(OUTPUT_DIR, "summary.json");

  // Write live chains list
  fs.writeFileSync(liveChainsPath, JSON.stringify(liveChains, null, 2));

  // Write all probe results
  fs.writeFileSync(allResultsPath, JSON.stringify(allProbeResults, null, 2));

  // Write summary
  const summary = {
    totalChains: liveChains.length,
    totalRpcsTested: allProbeResults.length,
    liveRpcs: allProbeResults.filter(r => r.reachable).length,
    deadRpcs: allProbeResults.filter(r => !r.reachable).length,
    chainsWithLiveRpcs: liveChains.length,
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  return { liveChainsPath, allResultsPath, summaryPath };
}

async function main() {
  info("Collecting RPC endpoints from ChainList and EthereumLists...");
  const endpoints = await collectAllEndpoints();

  // Fetch chain names from ethereum-lists
  const ethereumListsChains = await fetchEthereumListsAllChains();
  const chainNames: Record<string, string | undefined> = {};
  Object.entries(ethereumListsChains).forEach(([chainId, chain]) => {
    chainNames[chainId] = chain.name;
  });

  info(`Starting live chain probes with concurrency ${CONCURRENCY}`);
  const probeResults = await runProbes(endpoints);

  const liveRpcCount = probeResults.filter(r => r.reachable).length;
  const deadRpcCount = probeResults.filter(r => !r.reachable).length;

  warn(
    `Completed probes. Live RPCs: ${liveRpcCount}. Dead RPCs: ${deadRpcCount}.`,
  );

  const liveChains = buildLiveChainResults(probeResults, chainNames);

  info(`Found ${liveChains.length} chains with at least one live RPC endpoint`);

  const { liveChainsPath, allResultsPath, summaryPath } = writeResults(liveChains, probeResults);

  info(`Wrote live chains list to ${liveChainsPath}`);
  info(`Wrote all probe results to ${allResultsPath}`);
  info(`Wrote summary to ${summaryPath}`);
}

main().catch(err => {
  warn(`Live chain probe failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});