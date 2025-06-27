import { NetworkDetails, TestResultsCollection } from "../types";
import { generateSupportedChainsFile, writeChainRpcFiles } from "../services/fileService";
import config from "../constants/config";
import { getNetworkDetails } from "../services/chainService";

export function writeOutputFiles(
  results: TestResultsCollection,
  networkDetails: Record<string, NetworkDetails>,
): string[] {
  const modifiedFiles = writeChainRpcFiles(results.healthyRpcs, config.OUTPUT_DIR, chainId => {
    const network = getNetworkDetails(chainId, networkDetails);
    if (!network) return {};

    return {
      mainnetNetwork: network.networkType === "mainnet" ? network : undefined,
      testnetNetwork: network.networkType === "testnet" ? network : undefined,
    };
  });

  const supportedChainsFile = generateSupportedChainsFile(networkDetails);
  modifiedFiles.push(supportedChainsFile);
  return modifiedFiles;
}
