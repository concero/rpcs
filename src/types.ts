interface RpcEndpoint {
  chainId: string;
  url: string;
}

interface HealthyRpc extends RpcEndpoint {
  responseTime: number;
}

interface HealthyRpcsByChain {
  [chainId: string]: {
    rpcs: HealthyRpc[];
  };
}

interface ChainRpcOutput {
  id: string;
  urls: string[];
  chainSelector?: number;
}

export { ChainRpcOutput, HealthyRpc, RpcEndpoint, HealthyRpcsByChain };
