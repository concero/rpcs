import { EndpointCollection, HealthyRpc, NetworkDetails, TestResultsCollection } from "../types";
import { info } from "./logger";
import { getNetworkDetails } from "../services/chainService";
import { shouldProcessNetwork } from "./shouldProcessNetwork";

export function processTestResults(
  testResult: {
    healthyRpcs: HealthyRpc[];
    chainIdMismatches: Map<string, string[]>;
  },
  networkDetails: Record<string, NetworkDetails>,
  initialEndpoints: EndpointCollection,
): TestResultsCollection {
  if (testResult.chainIdMismatches.size > 0) {
    info("=== Chain ID Mismatches ===");
    testResult.chainIdMismatches.forEach((returnedIds, expectedId) => {
      info(`Chain ID ${expectedId} had mismatches: ${returnedIds.join(", ")}`);
    });
  }

  const rpcsByReturnedChainId = new Map<string, HealthyRpc[]>();

  testResult.healthyRpcs.forEach(rpc => {
    if (!rpcsByReturnedChainId.has(rpc.returnedChainId)) {
      rpcsByReturnedChainId.set(rpc.returnedChainId, []);
    }
    rpcsByReturnedChainId.get(rpc.returnedChainId)!.push(rpc);
  });
  rpcsByReturnedChainId.forEach(rpcs => rpcs.sort((a, b) => a.responseTime - b.responseTime));

  const filteredSortedRpcs = new Map(
    Array.from(rpcsByReturnedChainId.entries()).filter(([chainId]) => {
      const network = getNetworkDetails(chainId, networkDetails);
      if (!network) return false;

      return shouldProcessNetwork(network.networkType);
    }),
  );

  return {
    healthyRpcs: filteredSortedRpcs,
    networkDetails,
    initialEndpoints,
  };
}
