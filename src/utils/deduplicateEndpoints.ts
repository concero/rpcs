import { RpcEndpoint } from "../types";
import { sanitizeUrl } from "./sanitizeUrl";
import { isDomainBlacklisted } from "../constants/domainBlacklist";
import config from "../constants/config";

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

    // Skip blacklisted domains if enabled
    if (config.ENABLE_DOMAIN_BLACKLIST && isDomainBlacklisted(sanitizedUrl)) {
      return;
    }

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
