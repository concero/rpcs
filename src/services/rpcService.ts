import config from "./constants/config";
import fetchChainlistRpcs from "./fetchers/fetchChainlistRpcs";
import { debug, error, info } from "./logger";
import { testRpcEndpoints } from "./rpcTester";
import {
  extractEndpoints,
  filterRelevantChains,
  getNetworkForChain,
  getSupportedChainIds,
  organizeRpcsByChain,
} from "./chainService";
import { writeChainRpcFiles } from "./fileService";
import { commitAndPushChanges } from "./gitService";

export async function runRpcService() {
  try {
    info("Starting RPC service...");

    // Get supported chain IDs
    const supportedChainIds = getSupportedChainIds();
    info(`Supported chain IDs: ${supportedChainIds.join(", ")}`);

    // Fetch and filter chainlist RPCs
    const rawChainlistRpcs = await fetchChainlistRpcs();
    const chainlistRpcs = filterRelevantChains(rawChainlistRpcs, supportedChainIds);

    debug(
      `Found ${Object.keys(chainlistRpcs).length} chains to process out of ${
        Object.keys(rawChainlistRpcs).length
      } total chains`,
    );

    // Extract and test endpoints
    const allEndpoints = extractEndpoints(chainlistRpcs);
    const testedEndpoints = await testRpcEndpoints(allEndpoints);

    // Organize results by chain
    const rpcsByChain = organizeRpcsByChain(testedEndpoints);

    // Write output files
    const modifiedFiles = writeChainRpcFiles(rpcsByChain, config.OUTPUT_DIR, getNetworkForChain);

    // Commit and push changes
    await commitAndPushChanges(config.GIT_REPO_PATH, modifiedFiles);

    info("Service run complete");
    return rpcsByChain;
  } catch (err) {
    error(`Service run error: ${String(err)}`);
    throw err;
  }
}
