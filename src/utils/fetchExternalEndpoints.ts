import { RpcEndpoint, NetworkDetails } from "../types";
import { fetchChainlistData } from "../services/chainlistRpcs";
import {
  extractChainlistEndpoints,
  extractEthereumListsEndpoints,
  extractNetworkEndpoints,
  filterEthereumListsChains,
} from "./parsers";
import { fetchEthereumListsChains } from "../services/ethereumLists";

export async function fetchExternalEndpoints(
  supportedChainIds: string[],
  networkDetails: Record<string, NetworkDetails>,
): Promise<RpcEndpoint[]> {
  const networkEndpoints = extractNetworkEndpoints(networkDetails);
  const filteredChainlistRpcs = await fetchChainlistData(supportedChainIds);
  const ethereumListsChains = await fetchEthereumListsChains(supportedChainIds);
  const filteredEthereumListsChains = filterEthereumListsChains(
    ethereumListsChains,
    supportedChainIds,
  );

  const chainlistEndpoints = extractChainlistEndpoints(filteredChainlistRpcs);
  const ethereumListsEndpoints = extractEthereumListsEndpoints(filteredEthereumListsChains);

  return [...networkEndpoints, ...chainlistEndpoints, ...ethereumListsEndpoints];
}
