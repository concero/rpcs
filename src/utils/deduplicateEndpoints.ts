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
    const sanitizedUrl = sanitizeUrl(endpoint.url);
    endpoint.url = sanitizedUrl;

    if (
      !urlMap.has(sanitizedUrl) ||
      (endpoint.source === "chainlist" && urlMap.get(sanitizedUrl)?.source === "ethereum-lists") ||
      endpoint.source === "v2-networks"
    ) {
      urlMap.set(sanitizedUrl, endpoint);
    }
  });

  return Array.from(urlMap.values());
}
