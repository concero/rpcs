import config from "../constants/config";
import { ChainlistRpcs, HealthyRpc, RpcEndpoint } from "../types";
import { NetworkDetails } from "../types";

export function getSupportedChainIds(networkDetails: Record<string, NetworkDetails>): string[] {
  return Object.keys(networkDetails);
}

export function filterChainlistChains(
  rawChainlistRpcs: ChainlistRpcs,
  supportedChainIds: string[],
): ChainlistRpcs {
  return Object.fromEntries(
    Object.entries(rawChainlistRpcs).filter(
      ([chainId]) =>
        supportedChainIds.includes(chainId) &&
        !config.IGNORED_CHAINLIST_CHAIN_IDS.includes(parseInt(chainId, 10)),
    ),
  );
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

export function extractEthereumListsEndpoints(
  ethereumListsChains: Record<string, any>,
): RpcEndpoint[] {
  return Object.entries(ethereumListsChains).flatMap(([chainId, chain]) =>
    chain.rpc
      .filter(url => url.startsWith("http"))
      .map(url => ({
        chainId,
        url,
        source: "ethereum-lists" as const,
      })),
  );
}

export function extractChainlistEndpoints(chainlistRpcs: ChainlistRpcs): RpcEndpoint[] {
  return Object.entries(chainlistRpcs).flatMap(([chainId, { rpcs }]) =>
    rpcs.map(rpc => ({
      chainId,
      url: rpc,
      source: "chainlist" as const,
    })),
  );
}

export function extractNetworkEndpoints(
  networkDetails: Record<string, NetworkDetails>,
): RpcEndpoint[] {
  return Object.entries(networkDetails)
    .filter(([_, details]) => details.rpcs && details.rpcs.length > 0)
    .flatMap(([chainId, details]) =>
      details.rpcs
        .filter(url => url && url.startsWith("http"))
        .map(url => ({
          chainId,
          url,
          source: "v2-networks" as const,
        })),
    );
}

export function sortRpcs(testedRpcs: HealthyRpc[]): Map<string, HealthyRpc[]> {
  const rpcsByChain = new Map<string, HealthyRpc[]>();

  testedRpcs.forEach(rpc => {
    if (!rpcsByChain.has(rpc.chainId)) {
      rpcsByChain.set(rpc.chainId, []);
    }
    rpcsByChain.get(rpc.chainId)!.push(rpc);
  });

  rpcsByChain.forEach(rpcs => rpcs.sort((a, b) => a.responseTime - b.responseTime));

  return rpcsByChain;
}

export function getNetworkDetails(
  chainId: string,
  networkDetails: Record<string, NetworkDetails>,
): NetworkDetails | undefined {
  return networkDetails[chainId];
}
