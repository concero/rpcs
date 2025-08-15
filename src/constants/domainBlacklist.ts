/**
 * List of domains to blacklist in RPC endpoints.
 *
 * This list contains domains that should be excluded from RPC testing & output.
 */
export const domainBlacklist: string[] = [
  // "ankr.com", // Example
  "api.zan.top",
];

/**
 * Checks if a URL contains any blacklisted domains.
 *
 * @param url - The RPC endpoint URL to check
 * @returns boolean - True if the URL contains a blacklisted domain, false otherwise
 */
export function isDomainBlacklisted(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return domainBlacklist.some(domain => urlObj.hostname.includes(domain));
  } catch (error) {
    // If URL parsing fails, return false
    return false;
  }
}
