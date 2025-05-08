import config from "../constants/config";
import { error, info, debug, warn } from "../utils/logger";
import { getSupportedChainIds } from "./chainService";
import { commitAndPushChanges } from "./gitService";
import { HealthyRpc } from "../types";
import { fetchAllNetworkDetails } from "./networkService";
import { shouldCommitChanges } from "../utils/shouldCommitChanges";
import { generateStatistics } from "../utils/generateStatistics";
import { writeOutputFiles } from "../utils/writeOutputFiles";
import { deduplicateEndpoints } from "../utils/deduplicateEndpoints";
import { fetchEndpoints } from "./fetchEndpoints";
import { processTestResults } from "../utils/processTestResults";
import { RpcTester } from "./rpcTester";
import { endpointFailureTracker } from "./endpointFailureTracker";

export async function runRpcService(): Promise<Map<string, HealthyRpc[]>> {
  try {
    info("Starting RPC service...");

    const networkDetails = await fetchAllNetworkDetails();
    const supportedChainIds = getSupportedChainIds(networkDetails);
    info(`Supported chain IDs: ${supportedChainIds.join(", ")}`);

    const endpoints = await fetchEndpoints(supportedChainIds, networkDetails);
    const dedupedEndpoints = deduplicateEndpoints(endpoints);

    info(
      `Testing ${dedupedEndpoints.length} unique endpoints (${endpoints.chainlist.length} from chainlist, ` +
        `${endpoints.ethereumLists.length} from ethereum-lists, ${endpoints.v2Networks.length} from v2-networks, ` +
        `${endpoints.total - dedupedEndpoints.length} duplicates removed)`,
    );

    const rpcTester = new RpcTester(config.RPC_TESTER, {
      debug,
      info,
      warn,
      error,
    });

    const testResult = await rpcTester.testEndpoints(dedupedEndpoints);
    const results = processTestResults(testResult, networkDetails, endpoints.initialCollection);

    const modifiedFiles = writeOutputFiles(results, networkDetails);
    generateStatistics(results);

    if (shouldCommitChanges(modifiedFiles)) {
      await commitAndPushChanges(config.GIT_REPO_PATH, modifiedFiles);
    }

    info("Service run complete");
    return results.healthyRpcs;
  } catch (err) {
    error(`Service run error: ${String(err)}, ${err.stack}`);
    await endpointFailureTracker.flushAllLogs();

    throw err;
  }
}
