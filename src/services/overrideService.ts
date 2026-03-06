import { promises as fs } from "fs";
import path from "path";
import { HealthyRpc, NetworkDetails } from "../types";
import { info, warn, debug } from "../utils/logger";

interface OverrideEntry {
  rpcUrls: string[];
  getLogsBlockDepth?: number;
  batchRequestLimit?: number;
  chainSelector?: number;
  chainId: string;
}

interface OverrideData {
  [networkName: string]: OverrideEntry;
}

interface ValidatorOverrideRpc {
  url: string;
  getLogsBlockDepth?: number;
  batchRequestLimit?: number;
}

interface ValidatorOverrideEntry {
  rpcUrls: ValidatorOverrideRpc[];
  chainSelector?: number;
  chainId: string;
}

interface ValidatorOverrideData {
  [networkName: string]: ValidatorOverrideEntry;
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

  private async readValidatorOverrideFile(filename: string): Promise<ValidatorOverrideData> {
    const filePath = path.join(this.overridesDir, filename);

    try {
      const content = await fs.readFile(filePath, "utf-8");
      if (!content.trim()) return {};
      const data = JSON.parse(content) as ValidatorOverrideData;
      debug(`Loaded ${Object.keys(data).length} validator override entries from ${filename}`);
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        debug(`No validator override file found at ${filePath}`);
        return {};
      }
      warn(`Error reading validator override file ${filename}: ${error}`);
      return {};
    }
  }

  /**
   * @dev Override config should looks like this
   *  "ethereum": {
   *     "rpcUrls": [{
   *         "url": "https://eth.example.com",
   *         "getLogsBlockDepth": 9999999,
   *         "batchRequestLimit": 9999999
   *       }],
   *   }
   *   "chainSelector": 1,
   *   "chainId": "1"
   */
  async applyValidatorOverrides(
    batchSupportMap: Map<string, HealthyRpc[]>,
    blockDepthMap: Map<string, HealthyRpc[]>,
    networkDetails: Record<string, NetworkDetails>,
  ): Promise<{
    batchSupportMapWithOverrides: Map<string, HealthyRpc[]>;
    blockDepthMapWithOverrides: Map<string, HealthyRpc[]>;
  }> {
    info("Applying validator overrides...");

    const batchSupportMapWithOverrides = new Map(batchSupportMap);
    const blockDepthMapWithOverrides = new Map(blockDepthMap);

    const mainnetOverrides = await this.readValidatorOverrideFile("cre.mainnet.json");
    this.mergeValidatorOverrides(
      batchSupportMapWithOverrides,
      blockDepthMapWithOverrides,
      mainnetOverrides,
      networkDetails,
      "mainnet",
    );

    const testnetOverrides = await this.readValidatorOverrideFile("cre.testnet.json");
    this.mergeValidatorOverrides(
      batchSupportMapWithOverrides,
      blockDepthMapWithOverrides,
      testnetOverrides,
      networkDetails,
      "testnet",
    );

    return { batchSupportMapWithOverrides, blockDepthMapWithOverrides };
  }

  private mergeValidatorOverrides(
    batchMap: Map<string, HealthyRpc[]>,
    depthMap: Map<string, HealthyRpc[]>,
    overrides: ValidatorOverrideData,
    networkDetails: Record<string, NetworkDetails>,
    networkType: "mainnet" | "testnet",
  ): void {
    for (const [networkName, entry] of Object.entries(overrides)) {
      const network = networkDetails[networkName];

      if (!network) {
        warn(`Validator override network "${networkName}" not found in network details`);
        continue;
      }

      if (network.networkType !== networkType) {
        warn(
          `Validator override network "${networkName}" is ${network.networkType} but found in cre.${networkType}.json`,
        );
        continue;
      }

      const chainId = entry.chainId;

      const existingDepthUrls = new Set((depthMap.get(chainId) || []).map(r => r.url));
      const existingBatchUrls = new Set((batchMap.get(chainId) || []).map(r => r.url));

      for (const rpc of entry.rpcUrls) {
        const baseRpc: HealthyRpc = {
          chainId,
          url: rpc.url,
          source: "v2-networks" as const,
          responseTime: 0,
          returnedChainId: chainId,
          lastBlockNumber: 0,
        };

        if (rpc.getLogsBlockDepth != null && !existingDepthUrls.has(rpc.url)) {
          const depthList = depthMap.get(chainId) || [];
          depthList.push({
            ...baseRpc,
            getLogsBlockDepth: rpc.getLogsBlockDepth,
          });
          depthMap.set(chainId, depthList);
          existingDepthUrls.add(rpc.url);
        }

        if (rpc.batchRequestLimit != null && !existingBatchUrls.has(rpc.url)) {
          const batchList = batchMap.get(chainId) || [];
          batchList.push({
            ...baseRpc,
            batchRequestLimit: rpc.batchRequestLimit,
          });
          batchMap.set(chainId, batchList);
          existingBatchUrls.add(rpc.url);
        }
      }
    }
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
          getLogsBlockDepth: override.getLogsBlockDepth ?? 0,
          batchRequestLimit: override.batchRequestLimit ?? 0,
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
