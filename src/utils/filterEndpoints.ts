import { RpcEndpoint } from "../types";
import { sanitizeUrl } from "./sanitizeUrl";
import { isDomainBlacklisted } from "../constants/domainBlacklist";
import config from "../constants/config";
import { info } from "../utils/logger";

/**
 * Filter endpoints based on domain blacklist and removes duplicates
 *
 * @param endpoints Array of endpoints from all sources
 * @returns Filtered, deduplicated endpoints
 */
export function filterEndpoints(endpoints: RpcEndpoint[]): RpcEndpoint[] {
  // Sanitize all URLs
  const sanitizedEndpoints = endpoints.map(endpoint => ({
    ...endpoint,
    url: sanitizeUrl(endpoint.url),
  }));

  // Track statistics
  const stats = {
    total: sanitizedEndpoints.length,
    bySource: new Map<string, number>(),
    blacklisted: 0,
    duplicates: 0,
  };

  // Count by source
  sanitizedEndpoints.forEach(endpoint => {
    const count = stats.bySource.get(endpoint.source) || 0;
    stats.bySource.set(endpoint.source, count + 1);
  });

  // Filter blacklisted domains
  const nonBlacklisted = config.ENABLE_DOMAIN_BLACKLIST
    ? sanitizedEndpoints.filter(endpoint => {
        if (isDomainBlacklisted(endpoint.url)) {
          stats.blacklisted++;
          return false;
        }
        return true;
      })
    : sanitizedEndpoints;

  // Remove duplicates by URL
  const seen = new Set<string>();
  const uniqueEndpoints = nonBlacklisted.filter(endpoint => {
    if (seen.has(endpoint.url)) {
      stats.duplicates++;
      return false;
    }
    seen.add(endpoint.url);
    return true;
  });

  // Log statistics
  const sourceCounts = Array.from(stats.bySource.entries())
    .map(([source, count]) => `${count} from ${source}`)
    .join(", ");

  let message = `Testing ${uniqueEndpoints.length} unique endpoints: ${sourceCounts}`;
  if (stats.duplicates > 0) {
    message += `, ${stats.duplicates} duplicates removed`;
  }
  if (config.ENABLE_DOMAIN_BLACKLIST && stats.blacklisted > 0) {
    message += `, ${stats.blacklisted} blacklisted domains filtered`;
  }

  info(message);

  return uniqueEndpoints;
}
