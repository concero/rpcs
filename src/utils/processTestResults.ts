import { HealthyRpc, NetworkDetails } from "../types";
import { info, debug, warn } from "./logger";
import { shouldProcessNetwork } from "./shouldProcessNetwork";

export function processTestResults(
  testResult: {
    healthyRpcs: Map<string, HealthyRpc[]>;
    chainIdMismatches: Map<string, string[]>;
  },
  networkDetails: Record<string, NetworkDetails>,
): Map<string, HealthyRpc[]> {
  // Log chain ID mismatches
  if (testResult.chainIdMismatches.size > 0) {
    warn("=== Chain ID Mismatches ===");
    testResult.chainIdMismatches.forEach((returnedIds, expectedId) => {
      warn(`Chain ID ${expectedId} had mismatches: ${returnedIds.join(", ")}`);
    });
  }

  const results = new Map<string, HealthyRpc[]>();

  // Process each chain's healthy RPCs
  testResult.healthyRpcs.forEach((rpcs, chainId) => {
    // Find the network details for this chain ID
    const network = Object.values(networkDetails).find(n => n.chainId.toString() === chainId);

    if (!network) {
      debug(`No network details found for chain ID ${chainId}`);
      return;
    }

    // Check if we should process this network type
    if (!shouldProcessNetwork(network.networkType)) {
      debug(`Skipping chain ${chainId} (${network.name}) due to network type filter`);
      return;
    }

    // Sort RPCs by response time (fastest first)
    const sortedRpcs = [...rpcs].sort((a, b) => a.responseTime - b.responseTime);

    // Use the network name as the key for better readability
    results.set(network.name, sortedRpcs);
    debug(`${network.name} (${chainId}): ${sortedRpcs.length} healthy RPCs`);
  });

  info(`Processed ${results.size} networks with healthy RPCs`);

  return results;
}
