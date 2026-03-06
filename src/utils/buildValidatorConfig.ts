import config from "../constants/config";
import { HealthyRpc, NetworkDetails } from "../types";
import { findThresholdByMass } from "./findThresholdByMass";

export interface ValidatorChainConfig {
  rpcUrls: string[];
  getLogsBlockDepth?: number;
  batchRequestLimit?: number;
  chainSelector?: string | number;
  chainId: string;
}

type UrlMap = Map<string, number>;

const {
  MIN_RPC_AMOUNT,
  MIN_ACTIVE_NETWORK_RPC_AMOUNT,
  MIN_BATCH_THRESHOLD,
  MIN_DEPTH_THRESHOLD,
  MIN_ACTIVE_CHAIN_BATCH,
  MIN_ACTIVE_CHAIN_DEPTH,
  BATCH_MASS_THRESHOLD,
  DEPTH_MASS_THRESHOLD,
} = config.CRE_CONFIG;

function computeChainThresholds(
  depthRpcs: HealthyRpc[],
  batchRpcs: HealthyRpc[],
  activeChain: boolean,
): {
  depthThreshold: number;
  batchThreshold: number;
  depthUrlMap: UrlMap;
  batchUrlMap: UrlMap;
} {
  const filterForDepth = (getLogsBlockDepth: number) =>
    activeChain ? getLogsBlockDepth >= MIN_ACTIVE_CHAIN_DEPTH : getLogsBlockDepth > 0;
  const filterForBatch = (batchRequestLimit: number) =>
    activeChain ? batchRequestLimit >= MIN_ACTIVE_CHAIN_BATCH : batchRequestLimit > 0;

  const depthValues = depthRpcs.map(r => r.getLogsBlockDepth ?? 0).filter(filterForDepth);
  const batchValues = batchRpcs.map(r => r.batchRequestLimit ?? 0).filter(filterForBatch);

  const depthThreshold = findThresholdByMass(depthValues, DEPTH_MASS_THRESHOLD);
  const batchThreshold = findThresholdByMass(batchValues, BATCH_MASS_THRESHOLD);

  const depthUrlMap = new Map(depthRpcs.map(r => [r.url, r.getLogsBlockDepth ?? 0]));
  const batchUrlMap = new Map(batchRpcs.map(r => [r.url, r.batchRequestLimit ?? 0]));

  return { depthThreshold, batchThreshold, depthUrlMap, batchUrlMap };
}

function filterAndSortUrls(
  depthUrlMap: UrlMap,
  batchUrlMap: UrlMap,
  depthThreshold: number,
  batchThreshold: number,
): string[] {
  const allUrls = new Set([...depthUrlMap.keys(), ...batchUrlMap.keys()]);

  const rpcUrls = [...allUrls]
    .filter(url => {
      const depth = depthUrlMap.get(url) ?? 0;
      const batch = batchUrlMap.get(url) ?? 0;
      return depth >= depthThreshold && batch >= batchThreshold;
    })
    .sort((a, b) => {
      const batchA = batchUrlMap.get(a) ?? 0;
      const batchB = batchUrlMap.get(b) ?? 0;
      if (batchA !== batchB) return batchB - batchA;

      const depthA = depthUrlMap.get(a) ?? 0;
      const depthB = depthUrlMap.get(b) ?? 0;
      return depthB - depthA;
    });

  return rpcUrls;
}

export function buildValidatorConfig(
  blockDepthMap: Map<string, HealthyRpc[]>,
  batchSupportMap: Map<string, HealthyRpc[]>,
  healthyRpcsMap: Map<string, HealthyRpc[]>,
  networkDetails: Record<string, NetworkDetails>,
): Map<string, ValidatorChainConfig> {
  const result = new Map<string, ValidatorChainConfig>();

  for (const [networkName, network] of Object.entries(networkDetails)) {
    const chainIdStr = network.chainId.toString();
    const depthRpcs = blockDepthMap.get(chainIdStr) || [];
    const batchRpcs = batchSupportMap.get(chainIdStr) || [];

    if (depthRpcs.length === 0 && batchRpcs.length === 0) continue;

    const activeChain = depthRpcs.length > MIN_ACTIVE_NETWORK_RPC_AMOUNT;
    const { depthThreshold, batchThreshold, depthUrlMap, batchUrlMap } = computeChainThresholds(
      depthRpcs,
      batchRpcs,
      activeChain,
    );

    const rpcUrls = filterAndSortUrls(depthUrlMap, batchUrlMap, depthThreshold, batchThreshold);

    // Define fallback logic if we don't have enough good RPCs or if thresholds are too low
    const allRpcsForChain = healthyRpcsMap.get(networkName) || [];

    const needsFallback =
      rpcUrls.length <= MIN_RPC_AMOUNT && allRpcsForChain.length > MIN_RPC_AMOUNT;
    const thresholdsTooLow =
      depthThreshold < MIN_DEPTH_THRESHOLD && batchThreshold < MIN_BATCH_THRESHOLD;
    const useFallbackUrls = needsFallback || thresholdsTooLow;

    const finalUrls = useFallbackUrls ? allRpcsForChain.map(r => r.url) : rpcUrls;

    const includeDepth = !useFallbackUrls && depthThreshold >= MIN_DEPTH_THRESHOLD;
    const includeBatch = !useFallbackUrls && batchThreshold >= MIN_BATCH_THRESHOLD;

    result.set(networkName, {
      rpcUrls: finalUrls,
      ...(includeDepth && { getLogsBlockDepth: depthThreshold }),
      ...(includeBatch && { batchRequestLimit: batchThreshold }),
      chainSelector: network.chainSelector,
      chainId: chainIdStr,
    });
  }

  return result;
}
