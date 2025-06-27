import config from "../constants/config";
import { error, info } from "../utils/logger";
import { testRpcEndpoints } from "./rpcTester";
import { getSupportedChainIds } from "./chainService";
import { commitAndPushChanges } from "./gitService";
import { HealthyRpc } from "../types";
import { fetchAllNetworkDetails } from "./networkService";
import { shouldCommitChanges } from "../utils/shouldCommitChanges";
import { domainBlacklist } from "../constants/domainBlacklist";
import { generateStatistics } from "../utils/generateStatistics";
import { writeOutputFiles } from "../utils/writeOutputFiles";
import { deduplicateEndpoints } from "../utils/deduplicateEndpoints";
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
    info(`Supported chain IDs: ${supportedChainIds.join(", ")}`);

    // Fetch endpoints from all sources and remove duplicates
    const endpoints = await fetchEndpoints(supportedChainIds, networkDetails);
    const dedupedEndpoints = deduplicateEndpoints(endpoints);

    const endpointInfoParts = [
      `Testing ${dedupedEndpoints.length} unique endpoints (${endpoints.chainlist.length} from chainlist, `,
      `${endpoints.ethereumLists.length} from ethereum-lists, ${endpoints.v2Networks.length} from v2-networks, `,
      `${endpoints.total - dedupedEndpoints.length} duplicates removed`,
    ];

    if (config.ENABLE_DOMAIN_BLACKLIST && endpoints.blacklisted > 0) {
      endpointInfoParts.push(`, ${endpoints.blacklisted} blacklisted domains filtered`);
    }

    endpointInfoParts.push(")");
    info(endpointInfoParts.join(""));

    if (config.ENABLE_DOMAIN_BLACKLIST) {
      info(
        `Domain blacklist is active with ${domainBlacklist.length} entries: ${domainBlacklist.join(", ")}`,
      );
    }

    // Test all endpoints and process results
    const testResult = await testRpcEndpoints(dedupedEndpoints);
    const results = processTestResults(testResult, networkDetails, endpoints.initialCollection);

    // Write results to mainnet.json and testnet.json files
    const modifiedFiles = writeOutputFiles(results, networkDetails);
    generateStatistics(results);

    // Commit and push changes if configured
    if (shouldCommitChanges(modifiedFiles)) {
      await commitAndPushChanges(config.GIT_REPO_PATH, modifiedFiles);
    }

    info("Service run complete");
    return results.healthyRpcs;
  } catch (err) {
    error(`Service run error: ${String(err)}, ${err.stack}`);
    throw err;
  }
}
