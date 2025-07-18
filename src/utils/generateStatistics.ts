import { ChainStats, TestResultsCollection } from "../types";
import { getNetworkDetails } from "../services/chainService";
import { addMissingNetworksToStats } from "./addMissingNetworksToStats";
import { displayNetworkStats } from "./displayNetworkStats";

export function generateStatistics(results: TestResultsCollection): void {
  const mainnetStats: ChainStats[] = [];
  const testnetStats: ChainStats[] = [];
  const processedChainIds = new Set<string>();

  results.healthyRpcs.forEach((rpcs, chainId) => {
    const network = getNetworkDetails(chainId, results.networkDetails);
    if (!network) return;

    processedChainIds.add(chainId);

    const chainlistRpcs = rpcs.filter(rpc => rpc.source === "chainlist");
    const ethereumListsRpcs = rpcs.filter(rpc => rpc.source === "ethereum-lists");

    const initialChainlistCount = results.initialEndpoints.chainlist.get(chainId)?.length || 0;
    const initialEthereumListsCount =
      results.initialEndpoints.ethereumLists.get(chainId)?.length || 0;

    const unhealthyChainlistCount = initialChainlistCount;
    const unhealthyEthereumListsCount = initialEthereumListsCount;

    const stats = {
      chainId,
      name: network.name,
      healthyRpcCount: rpcs.length,
      chainlistRpcCount: chainlistRpcs.length,
      unhealthyChainlistCount,
      ethereumListsRpcCount: ethereumListsRpcs.length,
      unhealthyEthereumListsCount,
    };

    if (network.networkType === "mainnet") {
      mainnetStats.push(stats);
    } else {
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
