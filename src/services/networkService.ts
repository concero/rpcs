import { debug, error, info } from "../utils/logger";
import config from "../constants/config";

export interface NetworkData {
  [networkName: string]: {
    chainId: number;
    chainSelector: number;
  };
}
export interface NetworkDetails {
  name: string;
  chainId: number;
  chainSelector: number;
  rpcs: string[];
  blockExplorers: {
    name: string;
    url: string;
    apiUrl: string;
  }[];
  faucets: string[];
  networkType: "mainnet" | "testnet";
}

export async function fetchNetworksData(isMainnet: boolean): Promise<NetworkData> {
  const networkType = isMainnet ? "mainnet" : "testnet";
  const url = config.CONCERO_NETWORKS_DATA_URL_TEMPLATE.replace(
    "${CONCERO_NETWORKS_GITHUB_BASE_URL}",
    config.CONCERO_NETWORKS_GITHUB_BASE_URL,
  ).replace("${networkType}", networkType);

  try {
    // info(`Fetching ${networkType} networks from GitHub...`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${networkType} networks: ${response.status}`);
    }

    const data = await response.json();
    info(`Fetched ${Object.keys(data).length} ${networkType} networks from Concero`);
    return data as NetworkData;
  } catch (err) {
    error(`Error fetching ${networkType} networks: ${err}`);
    throw err;
  }
}

export async function fetchNetworkDetails(
  networkName: string,
  isMainnet: boolean,
): Promise<NetworkDetails | null> {
  const networkType = isMainnet ? "mainnet" : "testnet";
  const url = config.CONCERO_NETWORK_DETAILS_URL_TEMPLATE.replace(
    "${CONCERO_NETWORKS_GITHUB_BASE_URL}",
    config.CONCERO_NETWORKS_GITHUB_BASE_URL,
  )
    .replace("${networkType}", networkType)
    .replace("${networkName}", networkName);

  try {
    debug(`Fetching details for ${networkName} (${networkType})... from Concero`);
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status !== 404) {
        debug(`Failed to fetch network details for ${networkName}: ${response.status}`);
      }
      return null;
    }

    const data = (await response.json()) as Record<string, any>;
    return {
      ...data,
      networkType: networkType,
    } as NetworkDetails;
  } catch (err) {
    debug(`Error fetching network details for ${networkName}: ${err}`);
    return null;
  }
}

export async function fetchAllNetworkDetails(): Promise<Record<string, NetworkDetails>> {
  const result: Record<string, NetworkDetails> = {};

  async function processNetworks(isMainnet: boolean) {
    const networks = await fetchNetworksData(isMainnet);
    const networkType = isMainnet ? "mainnet" : "testnet";

    // info(`Fetching details for ${Object.keys(networks).length} ${networkType} networks...`);

    const fetchPromises = Object.entries(networks).map(async ([networkName, network]) => {
      const details = await fetchNetworkDetails(networkName, isMainnet);
      if (details) {
        result[network.chainId.toString()] = details;
      }
    });

    await Promise.all(fetchPromises);
  }

  if (config.NETWORK_MODE === 1 || config.NETWORK_MODE === 2) {
    await processNetworks(true);
  }

  if (config.NETWORK_MODE === 0 || config.NETWORK_MODE === 2) {
    await processNetworks(false);
  }

  info(`Fetched details for ${Object.keys(result).length} networks from Concero`);
  return result;
}
