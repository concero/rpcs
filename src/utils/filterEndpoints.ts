import { EndpointCollection, RpcEndpoint } from "../types";
import { sanitizeUrl } from "./sanitizeUrl";
import { isDomainBlacklisted } from "../constants/domainBlacklist";
import config from "../constants/config";
import { info } from "../utils/logger";

/**
 * Filter endpoints based on domain blacklist and removes duplicates across all sources
 *
 * @param endpoints Collection of endpoints from different sources
 * @returns Filtered, deduplicated endpoints and related statistics
 */
export function filterEndpoints(endpoints: EndpointCollection): RpcEndpoint[] {
  const urlMap = new Map<string, RpcEndpoint>();

  const stats = {
    total: 0,
    sources: {
      chainlist: 0,
      ethereumLists: 0,
      "v2-networks": 0,
    },
    blacklisted: 0,
  };

  const processEndpoints = (
    source: "chainlist" | "ethereumLists" | "v2-networks",
    endpointMap: Map<string, RpcEndpoint[]>,
  ) => {
    for (const endpoints of endpointMap.values()) {
      const count = endpoints.length;
      stats.total += count;

      stats.sources[source] += count;

      for (const endpoint of endpoints) {
        const sanitizedUrl = sanitizeUrl(endpoint.url);
        endpoint.url = sanitizedUrl;

        // Skip blacklisted domains if enabled
        if (config.ENABLE_DOMAIN_BLACKLIST && isDomainBlacklisted(sanitizedUrl)) {
          stats.blacklisted++;
          continue;
        }

        // Simple deduplication by URL
        if (!urlMap.has(sanitizedUrl)) {
          urlMap.set(sanitizedUrl, endpoint);
        }
      }
    }
  };

  processEndpoints("chainlist", endpoints.chainlist);
  processEndpoints("ethereumLists", endpoints.ethereumLists);
  processEndpoints("v2-networks", endpoints.v2Networks);

  const filteredEndpoints = Array.from(urlMap.values());
  const duplicatesRemoved = stats.total - stats.blacklisted - filteredEndpoints.length;

  const endpointInfoParts = [
    `Testing ${filteredEndpoints.length} unique endpoints: `,
    `${stats.sources.chainlist} from chainlist, `,
    `${stats.sources.ethereumLists} from ethereum-lists, `,
    `${stats.sources["v2-networks"]} from v2-networks, `,
    `${duplicatesRemoved} duplicates removed`,
  ];

  if (config.ENABLE_DOMAIN_BLACKLIST && stats.blacklisted > 0) {
    endpointInfoParts.push(`, ${stats.blacklisted} blacklisted domains filtered`);
  }

  info(endpointInfoParts.join(""));

  return filteredEndpoints;
}
