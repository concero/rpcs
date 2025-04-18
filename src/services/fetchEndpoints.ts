import { EndpointCollection, NetworkDetails, RpcEndpoint } from "../types";
import { fetchChainlistRpcs, parseChainlistRpcs } from "./chainlistService";
import {
  extractChainlistEndpoints,
  extractEthereumListsEndpoints,
  extractNetworkEndpoints,
  filterChainlistChains,
  filterEthereumListsChains,
} from "./chainService";
import { fetchEthereumListsChains } from "./ethereumListsService";
import { debug } from "../utils/logger";
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
