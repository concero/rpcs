import fs from "fs";
import path from "path";
import { debug } from "../utils/logger";
import { HealthyRpc, NetworkDetails } from "../types";
import config from "../constants/config";

/**
 * Ensures the output directory exists, creating it if necessary
 * @param outputDir The directory path to ensure exists
 * @returns The validated output directory path
 */
export function ensureOutputDirectoryExists(outputDir: string) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return outputDir;
}

/**
 * Data structure for consolidated chain data files
 * Maps chain IDs to their RPC details
 */
interface ChainData {
  [chainId: string]: {
    urls: string[];
    chainSelector?: string | number;
    name: string;
  };
}

/**
 * Generates consolidated RPC files instead of individual files per chain.
 * Creates two files: mainnet.json and testnet.json containing all chain RPCs.
 *
 * @param rpcsByChain Map of chain IDs to their healthy RPC endpoints
 * @param outputDir Directory where the output files will be written
 * @param getNetworkForChain Function to get network details for a chain ID
 * @param processMainnet Whether to process mainnet networks
 * @param processTestnet Whether to process testnet networks
 * @returns Array of paths to the modified files
 */
export function writeChainRpcFiles(
  rpcsByChain: Map<string, HealthyRpc[]>,
  outputDir: string,
  getNetworkForChain: (chainId: string) => {
    mainnetNetwork?: NetworkDetails;
    testnetNetwork?: NetworkDetails;
  },
  processMainnet: boolean = true,
  processTestnet: boolean = true,
): string[] {
  ensureOutputDirectoryExists(outputDir);
  const modifiedFiles: string[] = [];
  const mainnetChains: ChainData = {};
  const testnetChains: ChainData = {};

  rpcsByChain.forEach((rpcs, chainId) => {
    const { mainnetNetwork, testnetNetwork } = getNetworkForChain(chainId);
    const urls = rpcs.map(rpc => rpc.url);

    // Process mainnet network if it exists and is enabled
    if (mainnetNetwork && processMainnet) {
      mainnetChains[chainId] = {
        urls,
        chainSelector: mainnetNetwork.chainSelector,
        name: mainnetNetwork.name,
      };
    }

    // Process testnet network if it exists and is enabled
    if (testnetNetwork && processTestnet) {
      testnetChains[chainId] = {
        urls,
        chainSelector: testnetNetwork.chainSelector,
        name: testnetNetwork.name,
      };
    }

    if ((!mainnetNetwork || !processMainnet) && (!testnetNetwork || !processTestnet)) {
      debug(`No applicable network configuration found for chain ID ${chainId}`);
    }
  });

  // Write mainnet file - single consolidated file with all mainnet chains
  if (Object.keys(mainnetChains).length > 0 && processMainnet) {
    const mainnetPath = path.join(outputDir, "mainnet.json");
    fs.writeFileSync(mainnetPath, JSON.stringify(mainnetChains, null, 2));
    modifiedFiles.push(mainnetPath);
  }

  // Write testnet file - single consolidated file with all testnet chains
  if (Object.keys(testnetChains).length > 0 && processTestnet) {
    const testnetPath = path.join(outputDir, "testnet.json");
    fs.writeFileSync(testnetPath, JSON.stringify(testnetChains, null, 2));
    modifiedFiles.push(testnetPath);
  }

  return modifiedFiles;
}

/**
 * Generates a summary file listing all supported chains
 *
 * @param networkDetails Record of all network details indexed by chain ID
 * @returns Path to the generated supported-chains.json file
 */
export function generateSupportedChainsFile(
  networkDetails: Record<string, NetworkDetails>,
): string {
  ensureOutputDirectoryExists(config.OUTPUT_DIR);
  const outputPath = path.join(config.OUTPUT_DIR, "supported-chains.json");

  const mainnetObj: Record<string, string> = {};
  const testnetObj: Record<string, string> = {};

  Object.values(networkDetails).forEach(network => {
    if (network.networkType === "mainnet") {
      mainnetObj[network.chainId.toString()] = network.name;
    } else {
      testnetObj[network.chainId.toString()] = network.name;
    }
  });

  const supportedChains = {
    mainnet: mainnetObj,
    testnet: testnetObj,
  };

  fs.writeFileSync(outputPath, JSON.stringify(supportedChains, null, 2));
  return outputPath;
}
