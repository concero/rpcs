import config from "../constants/config";
import { error, info, debug, warn } from "../utils/logger";
import { testRpcEndpoints } from "./rpcTester";
import { getSupportedChainIds } from "./chainService";
import { commitAndPushChanges } from "./gitService";
import { HealthyRpc } from "../types";
import { fetchConceroNetworks } from "./conceroNetworkService";
import { shouldCommitChanges } from "../utils/shouldCommitChanges";
import { generateStatistics } from "../utils/generateStatistics";
import { writeOutputFiles } from "../utils/writeOutputFiles";
import { filterEndpoints } from "../utils/filterEndpoints";
import { fetchExternalEndpoints } from "./fetchExternalEndpoints";
import { processTestResults } from "../utils/processTestResults";

/**
 * Main RPC service function that orchestrates the entire process:
 * 1. Fetch network details
 * 2. Fetch RPC endpoints from multiple sources
 * 3. Test endpoints for health and performance
 * 4. Process results and generate only two output files: mainnet.json and testnet.json
 * 5. Commit changes to repository if configured
 *
 * @returns Map of chain IDs to their healthy RPC endpoints
 */
export async function runRpcService(): Promise<Map<string, HealthyRpc[]>> {
  try {
    info("Starting RPC service...");

    // Fetch network details and determine supported chains
    const conceroNetworks = await fetchConceroNetworks();

    const supportedChainIds = getSupportedChainIds(conceroNetworks);

    const endpoints = await fetchExternalEndpoints(supportedChainIds, conceroNetworks);

    const filteredEndpoints = filterEndpoints(endpoints);

    info(`Starting RPC endpoint testing for ${filteredEndpoints.length} endpoints...`);
    const testResult = await testRpcEndpoints(filteredEndpoints);

    debug(`Test results received: Map has ${testResult.healthyRpcs.size} entries`);
    debug(`Chain ID mismatches: ${testResult.chainIdMismatches.size}`);

    // Print out some sample data to debug
    if (testResult.healthyRpcs.size > 0) {
      const sampleChainId = Array.from(testResult.healthyRpcs.keys())[0];
      debug(
        `Sample chain ${sampleChainId} has ${testResult.healthyRpcs.get(sampleChainId)?.length || 0} healthy RPCs`,
      );
    }

    const results = processTestResults(testResult, conceroNetworks, endpoints);

    // Log summary of healthy RPCs
    const healthyRpcCount = Array.from(results.healthyRpcs.entries()).reduce(
      (total, [_, rpcs]) => total + rpcs.length,
      0,
    );
    const chainCount = results.healthyRpcs.size;

    info(`Processed test results: ${healthyRpcCount} healthy RPCs across ${chainCount} chains`);

    // Validate if we have any healthy RPCs
    if (healthyRpcCount === 0) {
      warn(`WARNING: No healthy RPCs found! Check the test and processing logic.`);
    }

    // Log details for each chain
    results.healthyRpcs.forEach((rpcs, chainId) => {
      const network = conceroNetworks[chainId];
      const networkName = network ? network.name : "Unknown";
      debug(`Chain ${chainId} (${networkName}): ${rpcs.length} healthy RPCs`);
    });
    const modifiedFiles = writeOutputFiles(results, conceroNetworks); // Only generates mainnet.json and testnet.json
    generateStatistics(results);

    if (shouldCommitChanges(modifiedFiles)) {
      await commitAndPushChanges(config.GIT.REPO_PATH, modifiedFiles);
    }

    info("Service run complete");
    return results.healthyRpcs;
  } catch (err) {
    error(`Service run error: ${String(err)}, ${err.stack}`);
    throw err;
  }
}
