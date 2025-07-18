import { NetworkDetails, TestResultsCollection } from "../types";
import { writeChainRpcFiles } from "../services/fileService";
import config from "../constants/config";
import { info } from "../utils/logger";

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
  // Write only the main RPC files (mainnet.json and testnet.json)
  const modifiedFiles = writeChainRpcFiles(results.healthyRpcs, config.OUTPUT_DIR, networkDetails);

  // No longer generating supported-chains.json file
  info("Only mainnet.json and testnet.json files are generated");

  return modifiedFiles;
}
