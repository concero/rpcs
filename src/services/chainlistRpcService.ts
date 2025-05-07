import { debug, info } from "../utils/logger";
import config from "../constants/config";
import { ChainlistRpc, ChainlistRpcData, ChainlistRpcs } from "../types";
import { fetchChainlistExtraRpcs, parseChainlistExtraRpcs } from "./chainlistExtraRpcService";

export async function fetchChainlistData(supportedChainIds: string[]): Promise<ChainlistRpcs> {
  const primaryData = await fetchChainlistRpcs();
  const extraData = await fetchChainlistExtraRpcs();

  const primaryRpcs = parseChainlistRpcs(primaryData);
  const extraRpcs = parseChainlistExtraRpcs(extraData);

  const mergedRpcs = mergeChainlistRpcs(primaryRpcs, extraRpcs);

  const filteredRpcs = filterSupportedChainlistRpcs(mergedRpcs, supportedChainIds);

  info(`Processed chainlist data: ${Object.keys(filteredRpcs).length} supported chains`);
  return filteredRpcs;
}

// Filter chainlist RPCs to only include supported chain IDs
export function filterSupportedChainlistRpcs(
  rawChainlistRpcs: ChainlistRpcs,
  supportedChainIds: string[],
): ChainlistRpcs {
  return Object.fromEntries(
    Object.entries(rawChainlistRpcs).filter(
      ([chainId]) =>
        supportedChainIds.includes(chainId) &&
        !config.IGNORED_CHAINLIST_CHAIN_IDS.includes(parseInt(chainId, 10)),
    ),
  );
}

export async function fetchChainlistRpcs(): Promise<any> {
  try {
    const response = await fetch(config.CHAINLIST_RPCS_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch chainlist RPCs: ${response.status}`);
    }
    const data = await response.json();
    info(`Fetched ${data.length} chains from chainlist primary source`);
    return data;
  } catch (error) {
    debug(`Error fetching chainlist RPCs: ${error}`);
    return [];
  }
}

export function parseChainlistRpcs(data: any[]): ChainlistRpcs {
  const result: ChainlistRpcs = {};

  data.forEach(item => {
    if (!item.chainId) return;

    const chainId = item.chainId.toString();

    // Extract URLs from the rpc array
    const rpcs = Array.isArray(item.rpc)
      ? item.rpc
          .filter((rpc: any) => {
            const url = typeof rpc === "string" ? rpc : rpc && rpc.url;
            return url && typeof url === "string" && url.startsWith("http");
          })
          .map((rpc: any) => (typeof rpc === "string" ? rpc : rpc.url))
      : [];

    if (rpcs.length === 0) return;

    result[chainId] = {
      rpcs,
      name: item.name,
      shortName: item.shortName,
      chain: item.chain,
    };
  });

  return result;
}

// Merge two chainlist RPC objects, combining RPCs for same chain IDs
export function mergeChainlistRpcs(primary: ChainlistRpcs, extra: ChainlistRpcs): ChainlistRpcs {
  const result: ChainlistRpcs = { ...primary };

  // Process each chain from the extra source
  Object.entries(extra).forEach(([chainId, extraChain]) => {
    if (result[chainId]) {
      // Chain exists in primary source, merge RPCs
      const uniqueRpcs = new Set([...result[chainId].rpcs, ...extraChain.rpcs]);
      result[chainId].rpcs = Array.from(uniqueRpcs);

      // Preserve other metadata if missing in primary
      if (!result[chainId].name && extraChain.name) {
        result[chainId].name = extraChain.name;
      }
      if (!result[chainId].shortName && extraChain.shortName) {
        result[chainId].shortName = extraChain.shortName;
      }
      if (!result[chainId].chain && extraChain.chain) {
        result[chainId].chain = extraChain.chain;
      }
    } else {
      // Chain only exists in extra source
      result[chainId] = extraChain;
    }
  });

  return result;
}
