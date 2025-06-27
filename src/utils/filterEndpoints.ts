import { EndpointCollection, RpcEndpoint } from "../types";
import { sanitizeUrl } from "./sanitizeUrl";
import { isDomainBlacklisted } from "../constants/domainBlacklist";
import config from "../constants/config";
import { info } from "../utils/logger";
import { domainBlacklist } from "../constants/domainBlacklist";

/**
 * Filter endpoints based on domain blacklist and removes duplicates across all sources
 *
 * @param endpoints Collection of endpoints from different sources
 * @returns Filtered, deduplicated endpoints and related statistics
 */
export function filterEndpoints(endpoints: EndpointCollection): {
  filteredEndpoints: RpcEndpoint[];
} {
  const urlMap = new Map<string, RpcEndpoint>();
  let totalEndpoints = 0;
  let chainlistCount = 0;
  let ethereumListsCount = 0;
  let v2NetworksCount = 0;
  let blacklistedCount = 0;

  const processEndpoints = (
    source: "chainlist" | "ethereumLists" | "v2-networks",
    endpointMap: Map<string, RpcEndpoint[]>,
  ) => {
    for (const endpoints of endpointMap.values()) {
      totalEndpoints += endpoints.length;

      // Count endpoints by source
      if (source === "chainlist") chainlistCount += endpoints.length;
      else if (source === "ethereumLists") ethereumListsCount += endpoints.length;
      else if (source === "v2-networks") v2NetworksCount += endpoints.length;

      for (const endpoint of endpoints) {
        const sanitizedUrl = sanitizeUrl(endpoint.url);
        endpoint.url = sanitizedUrl;

        // Skip blacklisted domains if enabled
        if (config.ENABLE_DOMAIN_BLACKLIST && isDomainBlacklisted(sanitizedUrl)) {
          blacklistedCount++;
          continue;
        }

        // Simple deduplication by URL
        if (!urlMap.has(sanitizedUrl)) {
          urlMap.set(sanitizedUrl, endpoint);
        }
      }
    }
  };

  // Process all collections
  processEndpoints("chainlist", endpoints.chainlist);
  processEndpoints("ethereumLists", endpoints.ethereumLists);
  processEndpoints("v2-networks", endpoints.v2Networks);

  const filteredEndpoints = Array.from(urlMap.values());
  const duplicatesRemoved = totalEndpoints - blacklistedCount - filteredEndpoints.length;

  // Log statistics about the filtering process
  const endpointInfoParts = [
    `Testing ${filteredEndpoints.length} unique endpoints `,
    `(${chainlistCount} from chainlist, `,
    `${ethereumListsCount} from ethereum-lists, `,
    `${v2NetworksCount} from v2-networks, `,
    `${duplicatesRemoved} duplicates removed`,
  ];

  if (config.ENABLE_DOMAIN_BLACKLIST && blacklistedCount > 0) {
    endpointInfoParts.push(`, ${blacklistedCount} blacklisted domains filtered`);
  }

  endpointInfoParts.push(")");
  info(endpointInfoParts.join(""));

  if (config.ENABLE_DOMAIN_BLACKLIST) {
    info(
      `Domain blacklist is active with ${domainBlacklist.length} entries: ${domainBlacklist.join(", ")}`,
    );
  }

  return {
    filteredEndpoints,
  };
}
