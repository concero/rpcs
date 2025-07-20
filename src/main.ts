import config from "./constants/config";
import { error, info } from "./utils/logger";
import { testRpcEndpoints } from "./services/rpcTester";
import { getSupportedChainIds } from "./utils/parsers";
import { commitAndPushChanges } from "./services/gitService";
import { HealthyRpc } from "./types";
import { fetchConceroNetworks } from "./services/conceroNetworks";
import { shouldCommitChanges } from "./utils/shouldCommitChanges";
import { displayStats } from "./utils/stats/displayStats";
import { writeChainRpcFiles } from "./services/fileService";
import { filterEndpoints } from "./utils/filterEndpoints";
import { fetchExternalEndpoints } from "./utils/fetchExternalEndpoints";
import { processTestResults } from "./utils/processTestResults";

/**
 * Main RPC service function that orchestrates the entire process:
 * 1. Fetch network details
 * 2. Fetch RPC endpoints from multiple sources
 * 3. Test endpoints for health and performance
 * 4. Process results and generate two output files: mainnet.json and testnet.json
 * 5. Commit changes to repository if configured
 *
 * @returns Map of chain IDs to their healthy RPC endpoints
 */
export async function main(): Promise<Map<string, HealthyRpc[]>> {
  try {
    info("Starting RPC service...");

    // Fetch network details and determine supported chains
    const conceroNetworks = await fetchConceroNetworks();

    const supportedChainIds = getSupportedChainIds(conceroNetworks);

    const endpoints = await fetchExternalEndpoints(supportedChainIds, conceroNetworks);

    const filteredEndpoints = filterEndpoints(endpoints);

    const testResult = await testRpcEndpoints(filteredEndpoints);

    const results = processTestResults(testResult, conceroNetworks, endpoints);

    const modifiedFiles = writeChainRpcFiles(
      results.healthyRpcs,
      config.OUTPUT_DIR,
      conceroNetworks,
    );
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
