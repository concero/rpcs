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

type RpcTag = "finalized" | "safe";

type TagProbeResult = {
  reachable: boolean;
  supported: boolean;
  error?: string;
};

type RpcProbeOutcome = {
  url: string;
  chainId: string;
  source: RpcEndpoint["source"];
  supportsFinalized: boolean;
  supportsSafe: boolean;
  finalizedError?: string;
  safeError?: string;
};

type ChainSummary = {
  chainId: string;
  totalReachable: number;
  includesFinalized: number;
  includesSafe: number;
  includesBoth: number;
  missingFinalized: number;
  missingSafe: number;
  missingBoth: number;
};

const REQUEST_TIMEOUT_MS = config.RPC_TESTER.HTTP_REQUEST_TIMEOUT_MS ?? 5_000;
const CONCURRENCY = config.RPC_TESTER.HTTP_REQUEST_CONCURRENCY ?? 25;
const OUTPUT_DIR = path.join(config.OUTPUT_DIR, "rpc-support");

async function fetchEthereumListsAllChains(): Promise<Record<string, { rpcs: string[] }>> {
  const response = await fetch(config.URLS.ETHEREUM_LISTS_CHAINS_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch ethereum-lists chains.json: ${response.status}`);
  }

  const chains = (await response.json()) as Array<{ chainId?: number; rpc?: string[] }>;
  const result: Record<string, { rpcs: string[] }> = {};

  chains.forEach(chain => {
    if (!chain.chainId || !Array.isArray(chain.rpc) || chain.rpc.length === 0) {
      return;
    }

    const chainId = chain.chainId.toString();
    const httpRpcs = chain.rpc.filter(url => typeof url === "string" && url.startsWith("http"));
    if (httpRpcs.length > 0) {
      result[chainId] = { rpcs: httpRpcs };
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

function formatError(err: any): string {
  if (!err) return "unknown error";
  if (typeof err === "string") return err;
  if (err.message) return err.message;
  if (typeof err === "object" && "code" in err && "message" in err) {
    return `${(err as any).code}: ${(err as any).message}`;
  }
  return JSON.stringify(err);
}

async function probeTag(url: string, tag: RpcTag): Promise<TagProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: tag === "finalized" ? 1 : 2,
        method: "eth_getBlockByNumber",
        params: [tag, false],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { reachable: false, supported: false, error: `HTTP ${response.status}` };
    }

    const json = (await response.json()) as { result?: unknown; error?: unknown };
    if (json.error) {
      return { reachable: true, supported: false, error: formatError(json.error) };
    }

    return { reachable: true, supported: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    debug(`Error probing ${url} for ${tag}: ${message}`);
    return { reachable: false, supported: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

async function probeEndpoint(endpoint: RpcEndpoint): Promise<RpcProbeOutcome | null> {
  const finalized = await probeTag(endpoint.url, "finalized");
  if (!finalized.reachable) {
    return null; // offline/unreachable
  }

  const safe = await probeTag(endpoint.url, "safe");
  if (!safe.reachable) {
    return null; // offline/unreachable
  }

  return {
    url: endpoint.url,
    chainId: endpoint.chainId,
    source: endpoint.source,
    supportsFinalized: finalized.supported,
    supportsSafe: safe.supported,
    finalizedError: finalized.supported ? undefined : finalized.error,
    safeError: safe.supported ? undefined : safe.error,
  };
}

async function runProbes(endpoints: RpcEndpoint[]): Promise<{
  successes: RpcProbeOutcome[];
  unsupported: RpcProbeOutcome[];
}> {
  const successes: RpcProbeOutcome[] = [];
  const unsupported: RpcProbeOutcome[] = [];

  let processed = 0;
  let index = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = index++;
      const endpoint = endpoints[currentIndex];
      if (!endpoint) break;

      const outcome = await probeEndpoint(endpoint);
      if (!outcome) continue;

      if (outcome.supportsFinalized && outcome.supportsSafe) {
        successes.push(outcome);
      } else {
        unsupported.push(outcome);
      }

      processed++;
      if (processed % 50 === 0) {
        info(`Probed ${processed}/${endpoints.length} endpoints...`);
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  return { successes, unsupported };
}

function categorizeResults(outcomes: RpcProbeOutcome[]) {
  const includesFinalized = outcomes.filter(outcome => outcome.supportsFinalized);
  const includesSafe = outcomes.filter(outcome => outcome.supportsSafe);
  const includesBoth = outcomes.filter(
    outcome => outcome.supportsFinalized && outcome.supportsSafe,
  );
  const missingFinalized = outcomes.filter(outcome => !outcome.supportsFinalized);
  const missingSafe = outcomes.filter(outcome => !outcome.supportsSafe);
  const missingBoth = outcomes.filter(
    outcome => !outcome.supportsFinalized && !outcome.supportsSafe,
  );

  return {
    includesFinalized,
    includesSafe,
    includesBoth,
    missingFinalized,
    missingSafe,
    missingBoth,
  };
}

function buildChainSummaries(outcomes: RpcProbeOutcome[]): Record<string, ChainSummary> {
  return outcomes.reduce<Record<string, ChainSummary>>((acc, outcome) => {
    const current = acc[outcome.chainId] ?? {
      chainId: outcome.chainId,
      totalReachable: 0,
      includesFinalized: 0,
      includesSafe: 0,
      includesBoth: 0,
      missingFinalized: 0,
      missingSafe: 0,
      missingBoth: 0,
    };
    const includesBoth = outcome.supportsFinalized && outcome.supportsSafe;
    const missingBoth = !outcome.supportsFinalized && !outcome.supportsSafe;

    current.totalReachable += 1;
    current.includesFinalized += outcome.supportsFinalized ? 1 : 0;
    current.includesSafe += outcome.supportsSafe ? 1 : 0;
    current.includesBoth += includesBoth ? 1 : 0;
    current.missingFinalized += outcome.supportsFinalized ? 0 : 1;
    current.missingSafe += outcome.supportsSafe ? 0 : 1;
    current.missingBoth += missingBoth ? 1 : 0;

    acc[outcome.chainId] = current;
    return acc;
  }, {});
}

function writeResults({
  includesFinalized,
  includesSafe,
  includesBoth,
  missingFinalized,
  missingSafe,
  missingBoth,
  chainSummaries,
}: {
  includesFinalized: RpcProbeOutcome[];
  includesSafe: RpcProbeOutcome[];
  includesBoth: RpcProbeOutcome[];
  missingFinalized: RpcProbeOutcome[];
  missingSafe: RpcProbeOutcome[];
  missingBoth: RpcProbeOutcome[];
  chainSummaries: Record<string, ChainSummary>;
}) {
  ensureOutputDirectoryExists(OUTPUT_DIR);

  const includesFinalizedPath = path.join(OUTPUT_DIR, "rpc-includes-finalized.json");
  const includesSafePath = path.join(OUTPUT_DIR, "rpc-includes-safe.json");
  const includesBothPath = path.join(OUTPUT_DIR, "rpc-includes-both.json");
  const missingFinalizedPath = path.join(OUTPUT_DIR, "rpc-missing-finalized.json");
  const missingSafePath = path.join(OUTPUT_DIR, "rpc-missing-safe.json");
  const missingBothPath = path.join(OUTPUT_DIR, "rpc-missing-both.json");
  const summaryPath = path.join(OUTPUT_DIR, "rpc-summary-by-chain.json");

  fs.writeFileSync(includesFinalizedPath, JSON.stringify(includesFinalized, null, 2));
  fs.writeFileSync(includesSafePath, JSON.stringify(includesSafe, null, 2));
  fs.writeFileSync(includesBothPath, JSON.stringify(includesBoth, null, 2));
  fs.writeFileSync(missingFinalizedPath, JSON.stringify(missingFinalized, null, 2));
  fs.writeFileSync(missingSafePath, JSON.stringify(missingSafe, null, 2));
  fs.writeFileSync(missingBothPath, JSON.stringify(missingBoth, null, 2));
  fs.writeFileSync(summaryPath, JSON.stringify(chainSummaries, null, 2));

  return {
    includesFinalizedPath,
    includesSafePath,
    includesBothPath,
    missingFinalizedPath,
    missingSafePath,
    missingBothPath,
    summaryPath,
  };
}

async function main() {
  info("Collecting RPC endpoints from ChainList and EthereumLists...");
  const endpoints = await collectAllEndpoints();

  info(`Starting RPC tag probes with concurrency ${CONCURRENCY}`);
  const { successes, unsupported } = await runProbes(endpoints);

  warn(
    `Completed probes. Supported: ${successes.length}. Unsupported (method error but online): ${unsupported.length}.`,
  );

  const reachableOutcomes = [...successes, ...unsupported];
  const {
    includesFinalized,
    includesSafe,
    includesBoth,
    missingFinalized,
    missingSafe,
    missingBoth,
  } = categorizeResults(reachableOutcomes);
  const chainSummaries = buildChainSummaries(reachableOutcomes);

  const {
    includesFinalizedPath,
    includesSafePath,
    includesBothPath,
    missingFinalizedPath,
    missingSafePath,
    missingBothPath,
    summaryPath,
  } = writeResults({
    includesFinalized,
    includesSafe,
    includesBoth,
    missingFinalized,
    missingSafe,
    missingBoth,
    chainSummaries,
  });

  info(`Wrote endpoints supporting finalized to ${includesFinalizedPath}`);
  info(`Wrote endpoints supporting safe to ${includesSafePath}`);
  info(`Wrote endpoints supporting both tags to ${includesBothPath}`);
  info(`Wrote finalized-unsupported endpoints to ${missingFinalizedPath}`);
  info(`Wrote safe-unsupported endpoints to ${missingSafePath}`);
  info(`Wrote endpoints missing both tags to ${missingBothPath}`);
  info(`Wrote chain summaries to ${summaryPath}`);
}

main().catch(err => {
  warn(`RPC probe failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
