import { NetworkDetails, TestResultsCollection } from "../types";
import { writeChainRpcFiles } from "../services/fileService";
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
  const modifiedFiles = writeChainRpcFiles(results.healthyRpcs, config.OUTPUT_DIR, networkDetails);
  return modifiedFiles;
}
