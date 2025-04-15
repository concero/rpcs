import { mainnetNetworks, testnetNetworks } from "@concero/contract-utils";
import config from "../constants/config";
import { ChainlistRpcs, HealthyRpc, RpcEndpoint } from "../types";
import { ConceroNetwork } from "@concero/contract-utils";

export function getSupportedChainIds(): string[] {
  return [
    ...Object.values(mainnetNetworks).map(network => network.chainId.toString()),
    ...Object.values(testnetNetworks).map(network => network.chainId.toString()),
  ];
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
  rawEthereumListsChains: EthereumListsChains,
  supportedChainIds: string[],
): EthereumListsChains {
  return Object.fromEntries(
    Object.entries(rawEthereumListsChains).filter(
      ([chainId]) =>
        supportedChainIds.includes(chainId) &&
        !config.IGNORED_ETHEREUM_LISTS_CHAIN_IDS.includes(parseInt(chainId, 10)),
    ),
  );
}

export function extractEthereumListsEndpoints(
  ethereumListsChains: Record<string, EthereumListsChain>,
): RpcEndpoint[] {
  return Object.entries(ethereumListsChains).flatMap(([chainId, chain]) =>
    chain.rpc
      .filter(url => url.startsWith("http")) // Filter out non-HTTP RPCs
      .map(url => ({
        chainId,
        url,
        source: "ethereum-lists" as const,
      })),
  );
}

// Update the existing extractEndpoints function
export function extractChainlistEndpoints(chainlistRpcs: ChainlistRpcs): RpcEndpoint[] {
  return Object.entries(chainlistRpcs).flatMap(([chainId, { rpcs }]) =>
    rpcs.map(rpc => ({
      chainId,
      url: rpc,
      source: "chainlist" as const,
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

  // Sort each chain's RPCs by response time
  rpcsByChain.forEach(rpcs => rpcs.sort((a, b) => a.responseTime - b.responseTime));

  return rpcsByChain;
}

export function getNetworkForChain(chainId: string): {
  mainnetNetwork?: ConceroNetwork;
  testnetNetwork?: ConceroNetwork;
} {
  const mainnetNetwork = Object.values(mainnetNetworks).find(
    network => network.chainId.toString() === chainId,
  );

  const testnetNetwork = Object.values(testnetNetworks).find(
    network => network.chainId.toString() === chainId,
  );

  return {
    mainnetNetwork: mainnetNetwork,
    testnetNetwork: testnetNetwork,
  };
}
