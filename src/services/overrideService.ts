import { promises as fs } from "fs";
import path from "path";
import { HealthyRpc, NetworkDetails } from "../types";
import { info, warn, debug } from "../utils/logger";

interface OverrideEntry {
  rpcUrls: string[];
  chainSelector?: number;
  chainId: string;
}

interface OverrideData {
  [networkName: string]: OverrideEntry;
}

/**
 * Service for handling RPC endpoint overrides
 * Allows manual addition of RPC endpoints that should always be included
 */
export class OverrideService {
  private overridesDir: string;

  constructor(overridesDir: string = "overrides") {
    this.overridesDir = overridesDir;
  }

  /**
   * Read override data from a JSON file
   * @param filename The override file to read (e.g., "mainnet.json", "testnet.json")
   * @returns The override data or empty object if file doesn't exist
   */
  private async readOverrideFile(filename: string): Promise<OverrideData> {
    const filePath = path.join(this.overridesDir, filename);

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content) as OverrideData;
      debug(`Loaded ${Object.keys(data).length} override entries from ${filename}`);
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        debug(`No override file found at ${filePath}`);
        return {};
      }
      warn(`Error reading override file ${filename}: ${error}`);
      return {};
    }
  }

  /**
   * Apply overrides to the healthy RPC results
   * Merges override RPCs with existing healthy RPCs, avoiding duplicates
   *
   * @param healthyRpcs Map of network names to their healthy RPC endpoints
   * @param networkDetails Details about all networks
   * @returns Updated map with override RPCs included
   */
  async applyOverrides(
    healthyRpcs: Map<string, HealthyRpc[]>,
    networkDetails: Record<string, NetworkDetails>,
  ): Promise<Map<string, HealthyRpc[]>> {
    info("Applying RPC overrides...");

    // Create a new map to avoid mutating the original
    const mergedRpcs = new Map(healthyRpcs);

    // Process mainnet overrides
    const mainnetOverrides = await this.readOverrideFile("mainnet.json");
    await this.mergeOverrides(mergedRpcs, mainnetOverrides, networkDetails, "mainnet");

    // Process testnet overrides
    const testnetOverrides = await this.readOverrideFile("testnet.json");
    await this.mergeOverrides(mergedRpcs, testnetOverrides, networkDetails, "testnet");

    return mergedRpcs;
  }

  /**
   * Merge override entries into the healthy RPCs map
   */
  private async mergeOverrides(
    healthyRpcs: Map<string, HealthyRpc[]>,
    overrides: OverrideData,
    networkDetails: Record<string, NetworkDetails>,
    networkType: "mainnet" | "testnet",
  ): Promise<void> {
    for (const [networkName, override] of Object.entries(overrides)) {
      // Find the network details
      const network = networkDetails[networkName];

      if (!network) {
        warn(`Override network "${networkName}" not found in network details`);
        continue;
      }

      // Verify network type matches
      if (network.networkType !== networkType) {
        warn(
          `Override network "${networkName}" is ${network.networkType} but found in ${networkType}.json`,
        );
        continue;
      }

      // Get existing healthy RPCs or empty array
      const existingRpcs = healthyRpcs.get(networkName) || [];
      const existingUrls = new Set(existingRpcs.map(rpc => rpc.url));

      // Create HealthyRpc objects for override URLs that aren't already present
      const newRpcs: HealthyRpc[] = override.rpcUrls
        .filter(url => !existingUrls.has(url))
        .map(url => ({
          chainId: network.chainId.toString(),
          url,
          source: "v2-networks" as const, // Mark overrides as coming from v2-networks
          responseTime: 0, // Override RPCs are assumed to be healthy
          returnedChainId: network.chainId.toString(),
          lastBlockNumber: 0,
        }));

      if (newRpcs.length > 0) {
        // Merge with existing RPCs, putting overrides at the beginning
        const mergedList = [...newRpcs, ...existingRpcs];
        healthyRpcs.set(networkName, mergedList);
        info(`Added ${newRpcs.length} override RPC(s) to ${networkName}`);
      }
    }
  }

  /**
   * Get all networks that have overrides defined
   */
  async getOverrideNetworks(): Promise<{
    mainnet: string[];
    testnet: string[];
  }> {
    const mainnetOverrides = await this.readOverrideFile("mainnet.json");
    const testnetOverrides = await this.readOverrideFile("testnet.json");

    return {
      mainnet: Object.keys(mainnetOverrides),
      testnet: Object.keys(testnetOverrides),
    };
  }
}

/**
 * Create a singleton instance of the override service
 */
export const overrideService = new OverrideService();
