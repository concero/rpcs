import { EndpointCollection, RpcEndpoint } from "../types";

export function createInitialEndpointCollection(
  chainlistEndpoints: RpcEndpoint[],
  ethereumListsEndpoints: RpcEndpoint[],
  networkEndpoints: RpcEndpoint[],
): EndpointCollection {
  const initialEndpoints: EndpointCollection = {
    chainlist: new Map<string, RpcEndpoint[]>(),
    ethereumLists: new Map<string, RpcEndpoint[]>(),
    v2Networks: new Map<string, RpcEndpoint[]>(),
  };

  const addToCollection = (endpoint: RpcEndpoint, collection: Map<string, RpcEndpoint[]>) => {
    if (!collection.has(endpoint.chainId)) {
      collection.set(endpoint.chainId, []);
    }
    collection.get(endpoint.chainId)!.push(endpoint);
  };

  chainlistEndpoints.forEach(endpoint => {
    addToCollection(endpoint, initialEndpoints.chainlist);
  });

  ethereumListsEndpoints.forEach(endpoint => {
    addToCollection(endpoint, initialEndpoints.ethereumLists);
  });

  networkEndpoints.forEach(endpoint => {
    addToCollection(endpoint, initialEndpoints.v2Networks);
  });

  return initialEndpoints;
}
