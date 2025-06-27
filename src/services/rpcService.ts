import config from "../constants/config";
import { error, info } from "../utils/logger";
import { testRpcEndpoints } from "./rpcTester";
import { getSupportedChainIds } from "./chainService";
import { commitAndPushChanges } from "./gitService";
import { HealthyRpc } from "../types";
import { fetchAllNetworkDetails } from "./networkService";
import { shouldCommitChanges } from "../utils/shouldCommitChanges";
import { generateStatistics } from "../utils/generateStatistics";
import { writeOutputFiles } from "../utils/writeOutputFiles";
import { filterEndpoints } from "../utils/filterEndpoints";
import { fetchEndpoints } from "./fetchEndpoints";
import { processTestResults } from "../utils/processTestResults";

/**
 * Main RPC service function that orchestrates the entire process:
 * 1. Fetch network details
 * 2. Fetch RPC endpoints from multiple sources
 * 3. Test endpoints for health and performance
 * 4. Process results and generate output files (mainnet.json and testnet.json)
 * 5. Commit changes to repository if configured
 *
 * @returns Map of chain IDs to their healthy RPC endpoints
 */
export async function runRpcService(): Promise<Map<string, HealthyRpc[]>> {
  try {
    info("Starting RPC service...");

    // Fetch network details and determine supported chains
    const networkDetails = await fetchAllNetworkDetails();
    const supportedChainIds = getSupportedChainIds(networkDetails);

    const endpoints = await fetchEndpoints(supportedChainIds, networkDetails);

    const filteredEndpoints = filterEndpoints(endpoints);

    const testResult = await testRpcEndpoints(filteredEndpoints);
    const results = processTestResults(testResult, networkDetails, endpoints);

    const modifiedFiles = writeOutputFiles(results, networkDetails);
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
