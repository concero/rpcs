import { ChainStats, EndpointCollection, NetworkDetails } from "../../types";
import config from "../../constants/config";

export function addMissingNetworksToStats(
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
