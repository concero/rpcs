import fs from "fs";
import path from "path";
import { info } from "../utils/logger";
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
 * Maps chain names to their RPC details
 */
interface ChainData {
  [chainName: string]: {
    rpcUrls: string[];
    chainSelector?: string | number;
    chainId: string;
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

  // Process all networks, not just those with healthy RPCs
  Object.entries(networkDetails).forEach(([networkName, network]) => {
    const chainId = network.chainId.toString();
    const rpcs = rpcsByChain.get(networkName) || [];
    const rpcUrls = rpcs.map(rpc => rpc.url);

    if (network.networkType === "mainnet") {
      mainnetChains[networkName] = {
        rpcUrls,
        chainSelector: network.chainSelector,
        chainId: chainId,
      };
    } else if (network.networkType === "testnet") {
      testnetChains[networkName] = {
        rpcUrls,
        chainSelector: network.chainSelector,
        chainId: chainId,
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
