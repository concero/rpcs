import http from "http";
import https from "https";

interface RpcEndpoint {
  chainId: string;
  url: string;
  source: "chainlist" | "ethereum-lists" | "v2-networks";
}
export interface RpcTestStepResult {
  success: boolean;
  rateLimited?: boolean;
  retryAfter?: number | null;
  responseTime?: number;
  jsonResult?: JsonRpcResponse;
  error?: string;
  isTimeout?: boolean;
  chainId?: string;
  blockNumber?: number;
}

interface RpcTestResult {
  healthyRpcs: HealthyRpc[];
  chainIdMismatches: Map<string, string[]>;
}

interface HealthyRpc extends RpcEndpoint {
  responseTime: number;
  returnedChainId: string;
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

export interface ChainlistRpcData {
  name: string;
  chain: string;
  icon?: string;
  features?: { name: string }[];
  rpc: { url: string }[];
  faucets?: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  infoURL?: string;
  shortName: string;
  chainId: number;
  networkId: number;
  slip44?: number;
  explorers?: {
    name: string;
    url: string;
    icon?: string;
    standard?: string;
  }[];
  parent?: {
    type: string;
    chain: string;
    bridges?: { url: string }[];
  };
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
  healthyRpcCount: number;
  chainlistRpcCount: number;
  ethereumListsRpcCount: number;
  unhealthyEthereumListsCount: number;
  unhealthyChainlistCount: number;
}

interface NetworkDetails {
  name: string;
  chainId: number;
  chainSelector: number;
  rpcs: string[];
  blockExplorers: {
    name: string;
    url: string;
    apiUrl: string;
  }[];
  faucets: string[];
  networkType: "mainnet" | "testnet";
}

interface NetworkData {
  [networkName: string]: {
    chainId: number;
    chainSelector: number;
  };
}

type EndpointMap = Map<string, RpcEndpoint[]>;

export type EndpointCollection = {
  chainlist: EndpointMap;
  ethereumLists: EndpointMap;
  v2Networks: EndpointMap;
};

export interface TestResultsCollection {
  healthyRpcs: Map<string, HealthyRpc[]>;
  networkDetails: Record<string, NetworkDetails>;
  initialEndpoints: EndpointCollection;
}

export {
  ChainRpcOutput,
  ChainStats,
  HealthyRpc,
  RpcEndpoint,
  RpcTestResult,
  NetworkDetails,
  NetworkData,
};

export interface JsonRpcResponse {
  jsonrpc: string;
  id: number | string;
  result?: string;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface NodeFetchOptions extends RequestInit {
  agent?: http.Agent | https.Agent;
}
