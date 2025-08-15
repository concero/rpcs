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
  httpStatus?: number;
  httpStatusText?: string;
}

interface RpcTestResult {
  healthyRpcs: Map<string, HealthyRpc[]>;
  chainIdMismatches: Map<string, string[]>;
  incomplete?: boolean;
}

interface HealthyRpc extends RpcEndpoint {
  responseTime: number;
  returnedChainId: string;
  lastBlockNumber: number;
  chainIdResponse?: JsonRpcResponse;
  blockNumberResponse?: JsonRpcResponse;
  getLogsResponse?: JsonRpcResponse;
}

interface ChainRpcOutput {
  id: string;
  name?: string;
  urls: string[];
  chainSelector?: number;
  debug?: {
    responses: {
      [url: string]: {
        chainIdResponse?: JsonRpcResponse;
        blockNumberResponse?: JsonRpcResponse;
        getLogsResponse?: JsonRpcResponse;
      };
    };
  };
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
  rpcUrls: string[];
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

// EndpointCollection removed - use RpcEndpoint[] directly

export interface TestResultsCollection {
  healthyRpcs: Map<string, HealthyRpc[]>;
  networkDetails: Record<string, NetworkDetails>;
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

// Track active requests for debugging purposes
export type EndpointStatus = {
  url: string;
  chainId: string;
  startTime: number;
  currentStage: "chainId" | "blockNumber" | "getLogs" | "waiting";
  attempt: number;
  maxRetries: number;
  retryAfter: number | null;
  waiting: boolean;
  waitUntil: number | null;
};
