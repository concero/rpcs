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
): Promise<EndpointCollection> {
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
