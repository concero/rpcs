import fs from "fs";
import path from "path";
import { debug, info } from "../utils/logger";
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
 * Maps chain IDs to their RPC details
 */
interface ChainData {
  [chainId: string]: {
    rpcUrls: string[];
    chainSelector?: string | number;
    name: string;
  };
}

/**
 * Writes consolidated mainnet.json and testnet.json files containing RPC endpoints
 *
 * @param rpcsByChain Map of chain IDs to their healthy RPC endpoints
 * @param outputDir Directory where the output files will be written
 * @param networkDetails Record of all network details indexed by chain ID
 * @returns Array of paths to the modified files
 */
export function writeChainRpcFiles(
  rpcsByChain: Map<string, HealthyRpc[]>,
  outputDir: string,
  networkDetails: Record<string, NetworkDetails>,
): string[] {
  ensureOutputDirectoryExists(outputDir);
  const mainnetChains: ChainData = {};
  const testnetChains: ChainData = {};

  rpcsByChain.forEach((rpcs, chainId) => {
    const network = networkDetails[chainId];
    if (!network) return;

    const rpcUrls = rpcs.map(rpc => rpc.url);

    if (network.networkType === "mainnet") {
      mainnetChains[chainId] = {
        rpcUrls,
        chainSelector: network.chainSelector,
      };
    } else if (network.networkType === "testnet") {
      testnetChains[chainId] = {
        rpcUrls,
        chainSelector: network.chainSelector,
      };
    }
  });

  // Log how many chains are going into each file
  info(`Writing mainnet.json with ${Object.keys(mainnetChains).length} chains`);
  info(`Writing testnet.json with ${Object.keys(testnetChains).length} chains`);

  const modifiedFiles: string[] = [];

  const mainnetPath = path.join(outputDir, "mainnet.json");
  fs.writeFileSync(mainnetPath, JSON.stringify(mainnetChains, null, 2));
  modifiedFiles.push(mainnetPath);

  const testnetPath = path.join(outputDir, "testnet.json");
  fs.writeFileSync(testnetPath, JSON.stringify(testnetChains, null, 2));
  modifiedFiles.push(testnetPath);

  return modifiedFiles;
}

/**
 * NOTE: This function is no longer used as we only generate mainnet.json and testnet.json
 * Kept for reference but not called from writeOutputFiles.
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
