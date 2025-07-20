import { EndpointCollection, NetworkDetails } from "../types";
import { fetchChainlistData } from "../services/chainlistRpcs";
import {
  extractChainlistEndpoints,
  extractEthereumListsEndpoints,
  extractNetworkEndpoints,
  filterEthereumListsChains,
} from "./parsers";
import { fetchEthereumListsChains } from "../services/ethereumLists";

import { createEndpointCollection } from "./createEndpointCollection";

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

  return createEndpointCollection(chainlistEndpoints, ethereumListsEndpoints, networkEndpoints);
}
