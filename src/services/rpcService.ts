import config from "../constants/config";
import { error, info, debug, warn } from "../utils/logger";
import { testRpcEndpoints } from "./rpcTester";
import { getSupportedChainIds } from "./parsers";
import { commitAndPushChanges } from "./gitService";
import { HealthyRpc } from "../types";
import { fetchConceroNetworks } from "./conceroNetworkService";
import { shouldCommitChanges } from "../utils/shouldCommitChanges";
import { displayStats } from "../utils/displayStats";
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

    const testResult = await testRpcEndpoints(filteredEndpoints);

    const results = processTestResults(testResult, conceroNetworks, endpoints);

    const modifiedFiles = writeOutputFiles(results, conceroNetworks);
    displayStats(results);

    if (shouldCommitChanges(modifiedFiles)) {
      await commitAndPushChanges(config.GIT.REPO_PATH, modifiedFiles);
    }

    return results.healthyRpcs;
  } catch (err) {
    error(`Service run error: ${String(err)}, ${err.stack}`);
    throw err;
  }
}
