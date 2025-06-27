import { NetworkDetails, TestResultsCollection } from "../types";
import { generateSupportedChainsFile, writeChainRpcFiles } from "../services/fileService";
import config from "../constants/config";

/**
 * Writes output files containing RPC endpoints and supported chains information
 *
 * @param results Collection of test results with healthy RPCs
 * @param networkDetails Network details record indexed by chain ID
 * @returns Array of paths to the modified files
 */
export function writeOutputFiles(
  results: TestResultsCollection,
  networkDetails: Record<string, NetworkDetails>,
): string[] {
  // Write the main RPC files (mainnet.json and testnet.json)
  const modifiedFiles = writeChainRpcFiles(results.healthyRpcs, config.OUTPUT_DIR, networkDetails);

  // Generate and write the supported-chains.json file
  const supportedChainsFile = generateSupportedChainsFile(networkDetails);
  modifiedFiles.push(supportedChainsFile);

  return modifiedFiles;
}
