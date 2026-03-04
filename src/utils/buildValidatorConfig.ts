import config from "../constants/config";
import { HealthyRpc, NetworkDetails } from "../types";
import { findThresholdByMass } from "./findThresholdByMass";

export interface ValidatorChainConfig {
  rpcUrls: string[];
  getLogsBlockDepth: number;
  maxBatchSize: number;
  chainSelector?: string | number;
  chainId: string;
}

const MIN_NETWORK_AMOUNT = 5;

export function buildValidatorConfig(
  blockDepthMap: Map<string, HealthyRpc[]>,
  batchSupportMap: Map<string, HealthyRpc[]>,
  networkDetails: Record<string, NetworkDetails>,
): Map<string, ValidatorChainConfig> {
  const result = new Map<string, ValidatorChainConfig>();

  for (const [networkName, network] of Object.entries(networkDetails)) {
    const chainIdStr = network.chainId.toString();
    const depthRpcs = blockDepthMap.get(chainIdStr) || [];
    const batchRpcs = batchSupportMap.get(chainIdStr) || [];

    if (depthRpcs.length === 0 && batchRpcs.length === 0) continue;

    const filterForDepth = (getLogsBlockDepth: number) =>
      depthRpcs.length >= MIN_NETWORK_AMOUNT
        ? getLogsBlockDepth >= config.DEPTH_TESTER.MIN_DEPTH
        : getLogsBlockDepth > 0;
    const filterForBatch = (maxBatchSize: number) =>
      batchRpcs.length >= MIN_NETWORK_AMOUNT
        ? maxBatchSize >= config.BATCH_TESTER.MIN_BATCH_SIZE
        : maxBatchSize > 0;

    const depthValues = depthRpcs.map(r => r.getLogsBlockDepth ?? 0).filter(filterForDepth);
    const batchValues = batchRpcs.map(r => r.maxBatchSize ?? 0).filter(filterForBatch);

    const depthThreshold = findThresholdByMass(depthValues, config.DEPTH_TESTER.MASS_THRESHOLD);
    const batchThreshold = findThresholdByMass(batchValues, config.BATCH_TESTER.MASS_THRESHOLD);

    const depthUrlMap = new Map(depthRpcs.map(r => [r.url, r.getLogsBlockDepth ?? 0]));
    const batchUrlMap = new Map(batchRpcs.map(r => [r.url, r.maxBatchSize ?? 0]));

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

    result.set(networkName, {
      rpcUrls,
      getLogsBlockDepth: depthThreshold,
      maxBatchSize: batchThreshold,
      chainSelector: network.chainSelector,
      chainId: network.chainId.toString(),
    });
  }

  return result;
}
