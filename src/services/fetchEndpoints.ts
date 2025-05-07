import { EndpointCollection, NetworkDetails, RpcEndpoint } from "../types";
import { fetchChainlistData } from "./chainlistRpcService";
import {
  extractChainlistEndpoints,
  extractEthereumListsEndpoints,
  extractNetworkEndpoints,
  filterEthereumListsChains,
} from "./chainService";
import { fetchEthereumListsChains } from "./ethereumListsService";
import { info } from "../utils/logger";
import { createInitialEndpointCollection } from "../utils/createInitialEndpointCollection";

export async function fetchEndpoints(
  supportedChainIds: string[],
  networkDetails: Record<string, NetworkDetails>,
): Promise<{
  chainlist: RpcEndpoint[];
  ethereumLists: RpcEndpoint[];
  v2Networks: RpcEndpoint[];
  total: number;
  initialCollection: EndpointCollection;
}> {
  // Fetch chainlist data with filtering already applied
  const filteredChainlistRpcs = await fetchChainlistData(supportedChainIds);

  // Fetch ethereum-lists data
  const ethereumListsChains = await fetchEthereumListsChains(supportedChainIds);
  const filteredEthereumListsChains = filterEthereumListsChains(
    ethereumListsChains,
    supportedChainIds,
  );

  info(
    `Found ${Object.keys(filteredChainlistRpcs).length} chains from chainlist and ` +
      `${Object.keys(filteredEthereumListsChains).length} chains from ethereum-lists to process`,
  );

  // Extract endpoints from the filtered data
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
