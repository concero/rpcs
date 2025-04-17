import config from "../constants/config";
import { fetchChainlistRpcs, parseChainlistRpcs } from "./chainlistService";
import { fetchEthereumListsChains } from "./ethereumListsService";
import { debug, error, info } from "../utils/logger";
import { testRpcEndpoints } from "./rpcTester";
import {
  extractChainlistEndpoints,
  extractEthereumListsEndpoints,
  extractNetworkEndpoints,
  filterChainlistChains,
  filterEthereumListsChains,
  getNetworkDetails,
  getSupportedChainIds,
} from "./chainService";
import { generateSupportedChainsFile, writeChainRpcFiles } from "./fileService";
import { commitAndPushChanges } from "./gitService";
import { ChainStats, HealthyRpc, NetworkDetails, RpcEndpoint } from "../types";
import { displayNetworkStats } from "../utils/displayNetworkStats";
import { sanitizeUrl } from "../utils/sanitizeUrl";
import { fetchAllNetworkDetails } from "./networkService";

type EndpointMap = Map<string, RpcEndpoint[]>;
type EndpointCollection = {
  chainlist: EndpointMap;
  ethereumLists: EndpointMap;
  v2Networks: EndpointMap;
};

interface TestResultsCollection {
  healthyRpcs: Map<string, HealthyRpc[]>;
  networkDetails: Record<string, NetworkDetails>;
  initialEndpoints: EndpointCollection;
}

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

    const testResult = await testRpcEndpoints(dedupedEndpoints);
    const results = processTestResults(testResult, networkDetails, endpoints.initialCollection);

    const modifiedFiles = writeOutputFiles(results, networkDetails);
    generateStatistics(results);

    if (shouldCommitChanges(modifiedFiles)) {
      await commitAndPushChanges(config.GIT_REPO_PATH, modifiedFiles);
    }

    info("Service run complete");
    return results.healthyRpcs;
  } catch (err) {
    error(`Service run error: ${String(err)}`);
    throw err;
  }
}

async function fetchEndpoints(
  supportedChainIds: string[],
  networkDetails: Record<string, NetworkDetails>,
): Promise<{
  chainlist: RpcEndpoint[];
  ethereumLists: RpcEndpoint[];
  v2Networks: RpcEndpoint[];
  total: number;
  initialCollection: EndpointCollection;
}> {
  const rawChainlistRpcs = await fetchChainlistRpcs();
  const parsedChainlistRpcs = parseChainlistRpcs(rawChainlistRpcs);
  const filteredChainlistRpcs = filterChainlistChains(parsedChainlistRpcs, supportedChainIds);

  const ethereumListsChains = await fetchEthereumListsChains(supportedChainIds);
  const filteredEthereumListsChains = filterEthereumListsChains(
    ethereumListsChains,
    supportedChainIds,
  );

  debug(
    `Found ${Object.keys(filteredChainlistRpcs).length} chains from chainlist and ` +
      `${Object.keys(filteredEthereumListsChains).length} chains from ethereum-lists to process`,
  );

  const chainlistEndpoints = extractChainlistEndpoints(filteredChainlistRpcs);
  const ethereumListsEndpoints = extractEthereumListsEndpoints(filteredEthereumListsChains);
  const networkEndpoints = extractNetworkEndpoints(networkDetails);

  const initialEndpoints = createInitialEndpointCollection(
    chainlistEndpoints,
    ethereumListsEndpoints,
    networkEndpoints,
  );

  return {
    chainlist: chainlistEndpoints,
    ethereumLists: ethereumListsEndpoints,
    v2Networks: networkEndpoints,
    total: chainlistEndpoints.length + ethereumListsEndpoints.length + networkEndpoints.length,
    initialCollection: initialEndpoints,
  };
}

function createInitialEndpointCollection(
  chainlistEndpoints: RpcEndpoint[],
  ethereumListsEndpoints: RpcEndpoint[],
  networkEndpoints: RpcEndpoint[],
): EndpointCollection {
  const initialEndpoints: EndpointCollection = {
    chainlist: new Map<string, RpcEndpoint[]>(),
    ethereumLists: new Map<string, RpcEndpoint[]>(),
    v2Networks: new Map<string, RpcEndpoint[]>(),
  };

  const addToCollection = (endpoint: RpcEndpoint, collection: Map<string, RpcEndpoint[]>) => {
    if (!collection.has(endpoint.chainId)) {
      collection.set(endpoint.chainId, []);
    }
    collection.get(endpoint.chainId)!.push(endpoint);
  };

  chainlistEndpoints.forEach(endpoint => {
    addToCollection(endpoint, initialEndpoints.chainlist);
  });

  ethereumListsEndpoints.forEach(endpoint => {
    addToCollection(endpoint, initialEndpoints.ethereumLists);
  });

  networkEndpoints.forEach(endpoint => {
    addToCollection(endpoint, initialEndpoints.v2Networks);
  });

  return initialEndpoints;
}

function deduplicateEndpoints(endpoints: {
  chainlist: RpcEndpoint[];
  ethereumLists: RpcEndpoint[];
  v2Networks: RpcEndpoint[];
}): RpcEndpoint[] {
  const urlMap = new Map<string, RpcEndpoint>();
  const allEndpointsArray = [
    ...endpoints.chainlist,
    ...endpoints.ethereumLists,
    ...endpoints.v2Networks,
  ];

  allEndpointsArray.forEach(endpoint => {
    const sanitizedUrl = sanitizeUrl(endpoint.url);
    endpoint.url = sanitizedUrl;

    if (
      !urlMap.has(sanitizedUrl) ||
      (endpoint.source === "chainlist" && urlMap.get(sanitizedUrl)?.source === "ethereum-lists") ||
      endpoint.source === "v2-networks"
    ) {
      urlMap.set(sanitizedUrl, endpoint);
    }
  });

  return Array.from(urlMap.values());
}

function processTestResults(
  testResult: {
    healthyRpcs: HealthyRpc[];
    chainIdMismatches: Map<string, string[]>;
  },
  networkDetails: Record<string, NetworkDetails>,
  initialEndpoints: EndpointCollection,
): TestResultsCollection {
  if (testResult.chainIdMismatches.size > 0) {
    info("=== Chain ID Mismatches ===");
    testResult.chainIdMismatches.forEach((returnedIds, expectedId) => {
      info(`Chain ID ${expectedId} had mismatches: ${returnedIds.join(", ")}`);
    });
  }

  const rpcsByReturnedChainId = new Map<string, HealthyRpc[]>();

  testResult.healthyRpcs.forEach(rpc => {
    if (!rpcsByReturnedChainId.has(rpc.returnedChainId)) {
      rpcsByReturnedChainId.set(rpc.returnedChainId, []);
    }
    rpcsByReturnedChainId.get(rpc.returnedChainId)!.push(rpc);
  });

  rpcsByReturnedChainId.forEach(rpcs => rpcs.sort((a, b) => a.responseTime - b.responseTime));

  const shouldProcessMainnet = config.NETWORK_MODE === 1 || config.NETWORK_MODE === 2;
  const shouldProcessTestnet = config.NETWORK_MODE === 0 || config.NETWORK_MODE === 2;

  const filteredSortedRpcs = new Map(
    Array.from(rpcsByReturnedChainId.entries()).filter(([chainId]) => {
      const network = getNetworkDetails(chainId, networkDetails);
      if (!network) return false;

      const isMainnet = network.networkType === "mainnet";
      return (isMainnet && shouldProcessMainnet) || (!isMainnet && shouldProcessTestnet);
    }),
  );

  return {
    healthyRpcs: filteredSortedRpcs,
    networkDetails,
    initialEndpoints,
  };
}

function writeOutputFiles(
  results: TestResultsCollection,
  networkDetails: Record<string, NetworkDetails>,
): string[] {
  const shouldProcessMainnet = config.NETWORK_MODE === 1 || config.NETWORK_MODE === 2;
  const shouldProcessTestnet = config.NETWORK_MODE === 0 || config.NETWORK_MODE === 2;

  const modifiedFiles = writeChainRpcFiles(
    results.healthyRpcs,
    config.OUTPUT_DIR,
    chainId => {
      const network = getNetworkDetails(chainId, networkDetails);
      if (!network) return {};

      return {
        mainnetNetwork: network.networkType === "mainnet" ? network : undefined,
        testnetNetwork: network.networkType === "testnet" ? network : undefined,
      };
    },
    shouldProcessMainnet,
    shouldProcessTestnet,
  );

  generateSupportedChainsFile(networkDetails);
  return modifiedFiles;
}

function generateStatistics(results: TestResultsCollection): void {
  const mainnetStats: ChainStats[] = [];
  const testnetStats: ChainStats[] = [];
  const processedChainIds = new Set<string>();
  const shouldProcessMainnet = config.NETWORK_MODE === 1 || config.NETWORK_MODE === 2;
  const shouldProcessTestnet = config.NETWORK_MODE === 0 || config.NETWORK_MODE === 2;

  results.healthyRpcs.forEach((rpcs, chainId) => {
    const network = getNetworkDetails(chainId, results.networkDetails);
    if (!network) return;

    processedChainIds.add(chainId);
    const isMainnet = network.networkType === "mainnet";

    const chainlistRpcs = rpcs.filter(rpc => rpc.source === "chainlist");
    const ethereumListsRpcs = rpcs.filter(rpc => rpc.source === "ethereum-lists");

    const initialChainlistCount = results.initialEndpoints.chainlist.get(chainId)?.length || 0;
    const initialEthereumListsCount =
      results.initialEndpoints.ethereumLists.get(chainId)?.length || 0;

    const unhealthyChainlistCount = initialChainlistCount - chainlistRpcs.length;
    const unhealthyEthereumListsCount = initialEthereumListsCount - ethereumListsRpcs.length;

    const stats = {
      chainId,
      name: network.name,
      healthyRpcCount: rpcs.length,
      chainlistRpcCount: chainlistRpcs.length,
      unhealthyChainlistCount,
      ethereumListsRpcCount: ethereumListsRpcs.length,
      unhealthyEthereumListsCount,
    };

    if (isMainnet && shouldProcessMainnet) {
      mainnetStats.push(stats);
    } else if (!isMainnet && shouldProcessTestnet) {
      testnetStats.push(stats);
    }
  });

  addMissingNetworksToStats(
    results.networkDetails,
    processedChainIds,
    results.initialEndpoints,
    mainnetStats,
    testnetStats,
  );

  displayNetworkStats(mainnetStats, testnetStats);
}

function addMissingNetworksToStats(
  networkDetails: Record<string, NetworkDetails>,
  processedChainIds: Set<string>,
  initialEndpoints: EndpointCollection,
  mainnetStats: ChainStats[],
  testnetStats: ChainStats[],
): void {
  const shouldProcessMainnet = config.NETWORK_MODE === 1 || config.NETWORK_MODE === 2;
  const shouldProcessTestnet = config.NETWORK_MODE === 0 || config.NETWORK_MODE === 2;

  Object.entries(networkDetails).forEach(([chainId, network]) => {
    if (processedChainIds.has(chainId)) return;

    const isMainnet = network.networkType === "mainnet";
    if ((isMainnet && !shouldProcessMainnet) || (!isMainnet && !shouldProcessTestnet)) {
      return;
    }

    const initialChainlistCount = initialEndpoints.chainlist.get(chainId)?.length || 0;
    const initialEthereumListsCount = initialEndpoints.ethereumLists.get(chainId)?.length || 0;

    const stats = {
      chainId,
      name: network.name,
      healthyRpcCount: 0,
      chainlistRpcCount: 0,
      unhealthyChainlistCount: initialChainlistCount,
      ethereumListsRpcCount: 0,
      unhealthyEthereumListsCount: initialEthereumListsCount,
    };

    if (isMainnet && shouldProcessMainnet) {
      mainnetStats.push(stats);
    } else if (!isMainnet && shouldProcessTestnet) {
      testnetStats.push(stats);
    }
  });
}

function shouldCommitChanges(modifiedFiles: string[]): boolean {
  if (config.ENABLE_GIT_SERVICE && modifiedFiles.length > 0) {
    info(`Committing ${modifiedFiles.length} modified files to git repository`);
    return true;
  } else if (!config.ENABLE_GIT_SERVICE) {
    info("Git service is disabled, skipping commit and push");
    return false;
  } else {
    info("No files were modified, skipping git operations");
    return false;
  }
}
