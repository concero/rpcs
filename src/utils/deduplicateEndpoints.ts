import { RpcEndpoint } from "../types";
import { sanitizeUrl } from "./sanitizeUrl";

export function deduplicateEndpoints(endpoints: {
  chainlist: RpcEndpoint[];
  ethereumLists: RpcEndpoint[];
  v2Networks: RpcEndpoint[];
}): RpcEndpoint[] {
  const urlMap = new Map<string, RpcEndpoint>();
  const allEndpointsArray = [
    ...endpoints.chainlist,
    ...endpoints.ethereumLists,
    ...endpoints.v2Networks,
  ];

  allEndpointsArray.forEach(endpoint => {
    if (
      !urlMap.has(endpoint.url) ||
      (endpoint.source === "chainlist" && urlMap.get(endpoint.url)?.source === "ethereum-lists") ||
      endpoint.source === "v2-networks"
    ) {
      urlMap.set(endpoint.url, endpoint);
    }
  });

  return Array.from(urlMap.values());
}
