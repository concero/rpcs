import { debug, error, info } from "../utils/logger";
import config from "../constants/config";
import { NetworkDetails } from "../types";

export async function fetchConceroNetworks(): Promise<Record<string, NetworkDetails>> {
  const result: Record<string, NetworkDetails> = {};

  const urls: { type: "mainnet" | "testnet"; enabled: boolean; url: string }[] = [
    {
      type: "mainnet",
      enabled: config.NETWORK_MODE === 1 || config.NETWORK_MODE === 2,
      url: `${config.URLS.CONCERO_NETWORKS_GITHUB_BASE_URL}/mainnet.json`,
    },
    {
      type: "testnet",
      enabled: config.NETWORK_MODE === 0 || config.NETWORK_MODE === 2,
      url: `${config.URLS.CONCERO_NETWORKS_GITHUB_BASE_URL}/testnet.json`,
    },
  ];

  for (const { enabled, url, type } of urls) {
    if (!enabled) continue;
    try {
      info(`Fetching ${type} networks from Concero...`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${type} networks: ${response.status}`);
      }
      const data = await response.json();
      const networks = data as Record<string, NetworkDetails>;

      // Set networkType for all networks and add to result
      for (const [key, network] of Object.entries(networks)) {
        network.networkType = type;
        result[key] = network;
      }

    } catch (err) {
      error(`Error fetching ${type} networks: ${err}`);
      throw err;
    }
  }

  info(`Fetched ${Object.keys(result).length} networks from Concero`);
  return result;
}
