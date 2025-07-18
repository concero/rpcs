import { EndpointCollection, HealthyRpc, NetworkDetails, TestResultsCollection } from "../types";
import { info, debug, error, warn } from "./logger";
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
  debug(`Processing test results for ${Object.keys(networkDetails).length} networks`);

  // Create a chainId to network name mapping for lookup
  const chainIdToNetworkName = new Map<string, string>();
  Object.entries(networkDetails).forEach(([networkName, details]) => {
    const chainIdStr = details.chainId.toString();
    chainIdToNetworkName.set(chainIdStr, networkName);
    // Also store the network name as key for direct lookup
    chainIdToNetworkName.set(networkName, networkName);
  });

  debug(`Created mapping for ${chainIdToNetworkName.size} chain IDs to network names`);

  // Ensure we have a Map of healthy RPCs
  if (!(testResult.healthyRpcs instanceof Map)) {
    error(`healthyRpcs is not a Map: ${typeof testResult.healthyRpcs}`);
    testResult.healthyRpcs = new Map();
  }

  // Log chain ID mismatches
  if (testResult.chainIdMismatches.size > 0) {
    warn("=== Chain ID Mismatches ===");
    testResult.chainIdMismatches.forEach((returnedIds, expectedId) => {
      warn(`Chain ID ${expectedId} had mismatches: ${returnedIds.join(", ")}`);
    });
  }

  // Process the test results and map chain IDs to their corresponding network names
  const processedRpcs = new Map<string, HealthyRpc[]>();

  // Track stats for debugging
  let totalRpcs = 0;
  let mappedRpcs = 0;
  let unmappedChains = 0;

  // Log the initial state
  debug(`Processing ${testResult.healthyRpcs.size} chains with healthy RPCs`);

  // For each chain ID in the test results, try to map it to a network name
  testResult.healthyRpcs.forEach((rpcs, chainId) => {
    const chainIdStr = chainId.toString();
    totalRpcs += rpcs.length;

    debug(`Processing chain ID ${chainIdStr} with ${rpcs.length} RPCs`);

    // Try to find the network name for this chain ID
    const networkName = chainIdToNetworkName.get(chainIdStr);

    if (networkName) {
      // We found a matching network name
      debug(`Mapped chain ID ${chainIdStr} to network ${networkName}`);

      // Check if we should process this network type
      const network = networkDetails[networkName];
      if (network && shouldProcessNetwork(network.networkType)) {
        // Add the RPCs to the processed map using the network name as key
        processedRpcs.set(networkName, [...rpcs]);
        mappedRpcs += rpcs.length;
        debug(`Added ${rpcs.length} RPCs for network ${networkName}`);
      } else {
        debug(`Skipping network ${networkName} due to network type filter`);
      }
    } else {
      // Try a reverse lookup by searching through network details
      const matchingNetwork = Object.entries(networkDetails).find(
        ([_, details]) => details.chainId.toString() === chainIdStr,
      );

      if (matchingNetwork) {
        const [name, details] = matchingNetwork;
        debug(`Found matching network ${name} for chain ID ${chainIdStr} through reverse lookup`);

        // Check if we should process this network type
        if (shouldProcessNetwork(details.networkType)) {
          // Add the RPCs to the processed map using the network name as key
          processedRpcs.set(name, [...rpcs]);
          mappedRpcs += rpcs.length;
          debug(`Added ${rpcs.length} RPCs for network ${name}`);
        } else {
          debug(`Skipping network ${name} due to network type filter`);
        }
      } else {
        // No matching network found
        debug(`No matching network found for chain ID ${chainIdStr}`);
        unmappedChains++;
      }
    }
  });

  debug(
    `Mapped ${mappedRpcs}/${totalRpcs} RPCs across ${processedRpcs.size} networks (${unmappedChains} unmapped chains)`,
  );

  if (processedRpcs.size === 0) {
    warn(`WARNING: No networks matched the chain IDs from healthy RPCs!`);
    warn(
      `This could be due to a mismatch between chain IDs in the test results and network names in Concero networks.`,
    );
  }

  // The filtered and sorted RPCs are now in processedRpcs
  const filteredSortedRpcs = processedRpcs;

  // Sort each chain's RPCs by response time
  filteredSortedRpcs.forEach((rpcs, chainId) => {
    rpcs.sort((a, b) => a.responseTime - b.responseTime);
    debug(`Chain ${chainId}: ${rpcs.length} healthy RPCs (sorted by response time)`);
  });

  // Log a summary of the results
  info(`After filtering: ${filteredSortedRpcs.size} networks with healthy RPCs`);
  if (filteredSortedRpcs.size === 0) {
    warn(
      `WARNING: All RPCs were filtered out. Check chain ID mapping between RPC test results and Concero networks.`,
    );
  }

  return {
    healthyRpcs: filteredSortedRpcs,
    networkDetails,
    initialEndpoints,
  };
}
