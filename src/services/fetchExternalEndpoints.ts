import { EndpointCollection, NetworkDetails, RpcEndpoint } from "../types";
import {
  fetchChainlistData,
} from "./chainlistRpcService";
import {
  extractChainlistEndpoints,
  extractEthereumListsEndpoints,
  extractNetworkEndpoints,
  filterEthereumListsChains,
} from "./parsers";
import { fetchEthereumListsChains } from "./ethereumListsService";

import { createInitialEndpointCollection } from "../utils/createInitialEndpointCollection";


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
