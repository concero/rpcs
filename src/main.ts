import config from "./constants/config";
import { error, info } from "./utils/logger";
import { testRpcEndpoints } from "./services/rpcTester";
import { getSupportedChainIds } from "./utils/parsers";
import { commitAndPushChanges } from "./services/gitService";
import { HealthyRpc } from "./types";
import { fetchConceroNetworks } from "./services/conceroNetworks";
import { shouldCommitChanges } from "./utils/shouldCommitChanges";
import { StatsCollector } from "./utils/StatsCollector";
import { writeChainRpcFiles } from "./services/fileService";
import { filterEndpoints } from "./utils/filterEndpoints";
import { fetchExternalEndpoints } from "./utils/fetchExternalEndpoints";
import { processTestResults } from "./utils/processTestResults";
import { overrideService } from "./services/overrideService";
import { testGetLogsBlockDepths } from "./services/getLogsBlockDepthTester";

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

    // 1. Fetch network configuration
    const networks = await fetchConceroNetworks();

    // Initialize stats collector
    const statsCollector = new StatsCollector(networks);
    statsCollector.initialize();
    const chainIds = getSupportedChainIds(networks);

    // 2. Fetch and filter endpoints
    const allEndpoints = await fetchExternalEndpoints(chainIds, networks);
    const uniqueEndpoints = filterEndpoints(allEndpoints);

    // 3. Test endpoints
    const testResult = await testRpcEndpoints(uniqueEndpoints, statsCollector);

    // 4. Process results
    const healthyRpcsByNetwork = processTestResults(testResult, networks);

    // 5. Test getLogs block depth (before overrides — override RPCs get values from config)
    if (config.GET_LOGS_TESTER.ENABLED) {
      await testGetLogsBlockDepths(healthyRpcsByNetwork);
    }

    // 6. Apply overrides (getLogsBlockDepth values come from override config)
    const rpcsByNetworkWithOverrides = await overrideService.applyOverrides(
      healthyRpcsByNetwork,
      networks,
    );

    // 7. Write output files
    const modifiedFiles = writeChainRpcFiles(
      rpcsByNetworkWithOverrides,
      config.OUTPUT_DIR,
      networks,
    );

    // 8. Display statistics
    statsCollector.display();

    // 9. Optional: commit changes
    if (shouldCommitChanges(modifiedFiles)) {
      await commitAndPushChanges(config.GIT.REPO_PATH, modifiedFiles);
    }

    return healthyRpcsByNetwork;
  } catch (err) {
    error(`Service run error: ${String(err)}, ${err.stack}`);
    throw err;
  }
}
