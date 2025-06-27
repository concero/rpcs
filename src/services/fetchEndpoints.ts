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
import { isDomainBlacklisted } from "../constants/domainBlacklist";
import config from "../constants/config";

export async function fetchEndpoints(
  supportedChainIds: string[],
  networkDetails: Record<string, NetworkDetails>,
): Promise<{
  chainlist: RpcEndpoint[];
  ethereumLists: RpcEndpoint[];
  v2Networks: RpcEndpoint[];
  total: number;
  blacklisted: number;
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

  let chainlistEndpoints = extractChainlistEndpoints(filteredChainlistRpcs);
  let ethereumListsEndpoints = extractEthereumListsEndpoints(filteredEthereumListsChains);
  let networkEndpoints = extractNetworkEndpoints(networkDetails);

  // Count of blacklisted endpoints before filtering
  const preFilterTotal =
    chainlistEndpoints.length + ethereumListsEndpoints.length + networkEndpoints.length;

  // Filter out blacklisted domains if enabled
  let blacklistedCount = 0;
  if (config.ENABLE_DOMAIN_BLACKLIST) {
    const originalChainlistLength = chainlistEndpoints.length;
    const originalEthereumListsLength = ethereumListsEndpoints.length;
    const originalNetworkEndpointsLength = networkEndpoints.length;

    chainlistEndpoints = chainlistEndpoints.filter(endpoint => !isDomainBlacklisted(endpoint.url));
    ethereumListsEndpoints = ethereumListsEndpoints.filter(
      endpoint => !isDomainBlacklisted(endpoint.url),
    );
    networkEndpoints = networkEndpoints.filter(endpoint => !isDomainBlacklisted(endpoint.url));

    blacklistedCount =
      originalChainlistLength -
      chainlistEndpoints.length +
      (originalEthereumListsLength - ethereumListsEndpoints.length) +
      (originalNetworkEndpointsLength - networkEndpoints.length);
  }

  const postFilterTotal =
    chainlistEndpoints.length + ethereumListsEndpoints.length + networkEndpoints.length;

  const initialEndpoints = createInitialEndpointCollection(
    chainlistEndpoints,
    ethereumListsEndpoints,
    networkEndpoints,
  );

  return {
    chainlist: chainlistEndpoints,
    ethereumLists: ethereumListsEndpoints,
    v2Networks: networkEndpoints,
    total: postFilterTotal,
    blacklisted: blacklistedCount,
    initialCollection: initialEndpoints,
  };
}
