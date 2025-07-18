import { EndpointCollection, NetworkDetails, RpcEndpoint } from "../types";
import {
  fetchChainlistData,
  fetchChainlistRpcs,
  filterSupportedChainlistRpcs,
  parseChainlistRpcs,
} from "./chainlistRpcService";
import {
  extractChainlistEndpoints,
  extractEthereumListsEndpoints,
  extractNetworkEndpoints,
  filterEthereumListsChains,
} from "./chainService";
import { fetchEthereumListsChains } from "./ethereumListsService";

import { createInitialEndpointCollection } from "../utils/createInitialEndpointCollection";
import { debug } from "../utils/logger";

export async function fetchExternalEndpoints(
  supportedChainIds: string[],
  networkDetails: Record<string, NetworkDetails>,
): Promise<EndpointCollection> {

  const filteredChainlistRpcs = await fetchChainlistData(supportedChainIds);

  const ethereumListsChains = await fetchEthereumListsChains(supportedChainIds);
  const filteredEthereumListsChains = filterEthereumListsChains(
    ethereumListsChains,
    supportedChainIds,
  );


  let chainlistEndpoints = extractChainlistEndpoints(filteredChainlistRpcs);
  let ethereumListsEndpoints = extractEthereumListsEndpoints(filteredEthereumListsChains);
  let networkEndpoints = extractNetworkEndpoints(networkDetails);

  // // Calculate total number of endpoints before any filtering
  // const totalEndpoints =
  //   chainlistEndpoints.length + ethereumListsEndpoints.length + networkEndpoints.length;

  return createInitialEndpointCollection(
    chainlistEndpoints,
    ethereumListsEndpoints,
    networkEndpoints,
  );
}
