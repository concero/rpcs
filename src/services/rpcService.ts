import config from "../constants/config";
import { fetchChainlistRpcs, parseChainlistRpcs } from "./chainlistService";
import { fetchEthereumListsChains } from "./ethereumListsService";
import { debug, error, info } from "../utils/logger";
import { testRpcEndpoints } from "./rpcTester";
import {
  extractChainlistEndpoints,
  extractEthereumListsEndpoints,
  filterChainlistChains,
  filterEthereumListsChains,
  getNetworkForChain,
  getSupportedChainIds,
} from "./chainService";
import { generateSupportedChainsFile, writeChainRpcFiles } from "./fileService";
import { commitAndPushChanges } from "./gitService";
import { ChainStats, HealthyRpc, RpcEndpoint } from "../types";
import { displayNetworkStats } from "../utils/displayNetworkStats";
import { sanitizeUrl } from "../utils/sanitizeUrl";

export async function runRpcService() {
  try {
    info("Starting RPC service...");

    // Get supported chain IDs
    const supportedChainIds = getSupportedChainIds();
    info(`Supported chain IDs: ${supportedChainIds.join(", ")}`);

    // Fetch and filter chainlist RPCs
    const rawChainlistRpcs = await fetchChainlistRpcs();
    const parsedChainlistRpcs = parseChainlistRpcs(rawChainlistRpcs);
    const filteredChainlistRpcs = filterChainlistChains(parsedChainlistRpcs, supportedChainIds);

    // Fetch ethereum-lists chains
    const ethereumListsChains = await fetchEthereumListsChains(supportedChainIds);
    const filteredEthereumListsChains = filterEthereumListsChains(
      ethereumListsChains,
      supportedChainIds,
    );

    debug(
      `Found ${Object.keys(filteredChainlistRpcs).length} chains from chainlist and ${
        Object.keys(filteredEthereumListsChains).length
      } chains from ethereum-lists to process`,
    );

    // Extract endpoints from both sources
    const chainlistEndpoints = extractChainlistEndpoints(filteredChainlistRpcs);
    const ethereumListsEndpoints = extractEthereumListsEndpoints(filteredEthereumListsChains);

    // Track initial endpoint counts by chain ID and source
    const initialEndpoints = {
      chainlist: new Map<string, RpcEndpoint[]>(),
      ethereumLists: new Map<string, RpcEndpoint[]>(),
    };

    // Group by chain ID for later statistics
    chainlistEndpoints.forEach(endpoint => {
      if (!initialEndpoints.chainlist.has(endpoint.chainId)) {
        initialEndpoints.chainlist.set(endpoint.chainId, []);
      }
      initialEndpoints.chainlist.get(endpoint.chainId)!.push(endpoint);
    });

    ethereumListsEndpoints.forEach(endpoint => {
      if (!initialEndpoints.ethereumLists.has(endpoint.chainId)) {
        initialEndpoints.ethereumLists.set(endpoint.chainId, []);
      }
      initialEndpoints.ethereumLists.get(endpoint.chainId)!.push(endpoint);
    });

    const urlMap = new Map<string, RpcEndpoint>();
    const allEndpointsArray = [...chainlistEndpoints, ...ethereumListsEndpoints];

    allEndpointsArray.forEach(endpoint => {
      const sanitizedUrl = sanitizeUrl(endpoint.url);
      endpoint.url = sanitizedUrl;

      if (!urlMap.has(sanitizedUrl) || endpoint.source === "chainlist") {
        urlMap.set(sanitizedUrl, endpoint);
      }
    });

    const dedupedEndpoints = Array.from(urlMap.values());

    info(
      `Testing ${dedupedEndpoints.length} unique endpoints (${chainlistEndpoints.length} from chainlist, ${ethereumListsEndpoints.length} from ethereum-lists, ${chainlistEndpoints.length + ethereumListsEndpoints.length - dedupedEndpoints.length} duplicates removed)`,
    );

    const testResult = await testRpcEndpoints(dedupedEndpoints);
    const testedEndpoints = testResult.healthyRpcs;

    if (testResult.chainIdMismatches.size > 0) {
      info("=== Chain ID Mismatches ===");
      testResult.chainIdMismatches.forEach((returnedIds, expectedId) => {
        info(`Chain ID ${expectedId} had mismatches: ${returnedIds.join(", ")}`);
      });
    }

    const rpcsByReturnedChainId = new Map<string, HealthyRpc[]>();

    testedEndpoints.forEach(rpc => {
      if (!rpcsByReturnedChainId.has(rpc.returnedChainId)) {
        rpcsByReturnedChainId.set(rpc.returnedChainId, []);
      }
      rpcsByReturnedChainId.get(rpc.returnedChainId)!.push(rpc);
    });

    rpcsByReturnedChainId.forEach(rpcs => rpcs.sort((a, b) => a.responseTime - b.responseTime));

    const mainnetStats: ChainStats[] = [];
    const testnetStats: ChainStats[] = [];

    const shouldProcessMainnet = config.NETWORK_MODE === 1 || config.NETWORK_MODE === 2;
    const shouldProcessTestnet = config.NETWORK_MODE === 0 || config.NETWORK_MODE === 2;

    const filteredSortedRpcs = new Map(
      Array.from(rpcsByReturnedChainId.entries()).filter(([chainId]) => {
        const { mainnetNetwork, testnetNetwork } = getNetworkForChain(chainId);

        if (mainnetNetwork && shouldProcessMainnet) return true;
        if (testnetNetwork && shouldProcessTestnet) return true;

        return false;
      }),
    );

    const modifiedFiles = writeChainRpcFiles(
      filteredSortedRpcs,
      config.OUTPUT_DIR,
      getNetworkForChain,
      shouldProcessMainnet,
      shouldProcessTestnet,
    );

    generateSupportedChainsFile();

    // Collect statistics
    filteredSortedRpcs.forEach((rpcs, chainId) => {
      const { mainnetNetwork, testnetNetwork } = getNetworkForChain(chainId);

      const chainlistRpcs = rpcs.filter(rpc => rpc.source === "chainlist");
      const ethereumListsRpcs = rpcs.filter(rpc => rpc.source === "ethereum-lists");

      const uniqueChainlistUrls = new Set(chainlistRpcs.map(rpc => rpc.url)).size;
      const uniqueEthereumListsUrls = new Set(ethereumListsRpcs.map(rpc => rpc.url)).size;

      const initialChainlistCount = initialEndpoints.chainlist.get(chainId)?.length || 0;
      const initialEthereumListsCount = initialEndpoints.ethereumLists.get(chainId)?.length || 0;

      const unhealthyChainlistCount = initialChainlistCount - chainlistRpcs.length;
      const unhealthyEthereumListsCount = initialEthereumListsCount - ethereumListsRpcs.length;

      if (mainnetNetwork && shouldProcessMainnet) {
        mainnetStats.push({
          chainId,
          name: mainnetNetwork.name,
          chainSelector: mainnetNetwork.chainSelector,
          healthyRpcCount: rpcs.length,
          chainlistRpcCount: chainlistRpcs.length,
          uniqueChainlistRpcCount: uniqueChainlistUrls,
          ethereumListsRpcCount: ethereumListsRpcs.length,
          uniqueEthereumListsRpcCount: uniqueEthereumListsUrls,
          unhealthyChainlistCount,
          unhealthyEthereumListsCount,
          initialChainlistCount,
          initialEthereumListsCount,
        });
      }

      if (testnetNetwork && shouldProcessTestnet) {
        testnetStats.push({
          chainId,
          name: testnetNetwork.name,
          chainSelector: testnetNetwork.chainSelector,
          healthyRpcCount: rpcs.length,
          chainlistRpcCount: chainlistRpcs.length,
          uniqueChainlistRpcCount: uniqueChainlistUrls,
          ethereumListsRpcCount: ethereumListsRpcs.length,
          uniqueEthereumListsRpcCount: uniqueEthereumListsUrls,
          unhealthyChainlistCount,
          unhealthyEthereumListsCount,
          initialChainlistCount,
          initialEthereumListsCount,
        });
      }
    });

    // Display statistics
    displayNetworkStats(mainnetStats, testnetStats);

    // Commit and push changes if enabled
    if (config.ENABLE_GIT_SERVICE && modifiedFiles.length > 0) {
      info(`Committing ${modifiedFiles.length} modified files to git repository`);
      await commitAndPushChanges(config.GIT_REPO_PATH, modifiedFiles);
    } else if (!config.ENABLE_GIT_SERVICE) {
      info("Git service is disabled, skipping commit and push");
    } else {
      info("No files were modified, skipping git operations");
    }

    info("Service run complete");
    return filteredSortedRpcs;
  } catch (err) {
    error(`Service run error: ${String(err)}`);

    throw err;
  }
}
