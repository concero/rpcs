import config from "../constants/config";
import { ChainlistRpcs, NetworkDetails, RpcEndpoint } from "../types";

export function getSupportedChainIds(networkDetails: Record<string, NetworkDetails>): string[] {
  const chainIds = Object.values(networkDetails).map(network => network.chainId.toString());
  return chainIds;
}

export function filterEthereumListsChains(
  rawEthereumListsChains: Record<string, any>,
  supportedChainIds: string[],
): Record<string, any> {
  return Object.fromEntries(
    Object.entries(rawEthereumListsChains).filter(
      ([chainId]) =>
        supportedChainIds.includes(chainId) &&
        !config.IGNORED_ETHEREUM_LISTS_CHAIN_IDS.includes(parseInt(chainId, 10)),
    ),
  );
}

// Generic endpoint extractor
type EndpointExtractor<T> = (data: T) => Array<{ chainId: string; urls: string[] }>;

export function extractEndpoints<T>(
  data: T,
  source: RpcEndpoint["source"],
  extractor: EndpointExtractor<T>,
): RpcEndpoint[] {
  return extractor(data).flatMap(({ chainId, urls }) =>
    urls.filter(url => url && url.startsWith("https://")).map(url => ({ chainId, url, source })),
  );
}

// Specific extractors using the generic function
export function extractEthereumListsEndpoints(
  ethereumListsChains: Record<string, any>,
): RpcEndpoint[] {
  return extractEndpoints(ethereumListsChains, "ethereum-lists", data =>
    Object.entries(data).map(([chainId, chain]) => ({
      chainId,
      urls: chain.rpc || [],
    })),
  );
}

export function extractChainlistEndpoints(chainlistRpcs: ChainlistRpcs): RpcEndpoint[] {
  return extractEndpoints(chainlistRpcs, "chainlist", data =>
    Object.entries(data).map(([chainId, { rpcs }]) => ({
      chainId,
      urls: rpcs,
    })),
  );
}

export function extractNetworkEndpoints(
  networkDetails: Record<string, NetworkDetails>,
): RpcEndpoint[] {
  return extractEndpoints(networkDetails, "v2-networks", data =>
    Object.entries(data)
      .filter(([_, details]) => details.rpcUrls && details.rpcUrls.length > 0)
      .map(([_, details]) => ({
        chainId: details.chainId.toString(),
        urls: details.rpcUrls,
      })),
  );
}

/**
 * Retrieves network details for a specific chain ID
 *
 * @param chainId The chain ID to retrieve details for
 * @param networkDetails Record of all network details indexed by chain ID
 * @returns The NetworkDetails object for the chain ID or undefined if not found
 */
export function getNetworkDetails(
  chainId: string,
  networkDetails: Record<string, NetworkDetails>,
): NetworkDetails | undefined {
  return networkDetails[chainId];
}
