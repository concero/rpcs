interface RpcEndpoint {
  chainId: string;
  url: string;
  source: "chainlist" | "ethereum-lists";
}
interface HealthyRpc extends RpcEndpoint {
  responseTime: number;
  returnedChainId: string;
}

interface HealthyRpcsByChain {
  [chainId: string]: {
    rpcs: HealthyRpc[];
  };
}

interface ChainRpcOutput {
  id: string;
  name?: string;
  urls: string[];
  chainSelector?: number;
}

export interface ChainlistRpc {
  rpcs: string[];
  name?: string;
  shortName?: string;
  chain?: string;
  ethereumListsVerified?: boolean;
  [key: string]: any;
}

export interface ChainlistRpcs {
  [chainId: string]: ChainlistRpc;
}

export interface EthereumListsNativeCurrency {
  name: string;
  symbol: string;
  decimals: number;
}

export interface EthereumListsExplorer {
  name: string;
  url: string;
  icon?: string;
  standard: string;
}

export interface EthereumListsChain {
  name: string;
  title?: string;
  chain: string;
  rpc: string[];
  faucets: string[];
  nativeCurrency: EthereumListsNativeCurrency;
  infoURL: string;
  shortName: string;
  chainId: number;
  networkId: number;
  icon?: string;
  explorers?: EthereumListsExplorer[];
}

interface ChainStats {
  chainId: string;
  name: string;
  chainSelector?: number;
  healthyRpcCount: number;
  ethereumListsRpcCount: number;
  uniqueEthereumListsRpcCount: number;
  chainlistRpcCount: number;
  uniqueChainlistRpcCount: number;
  unhealthyEthereumListsCount: number;
  unhealthyChainlistCount: number;
}

export { ChainRpcOutput, ChainStats, HealthyRpc, RpcEndpoint, HealthyRpcsByChain };
