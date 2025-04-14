import fs from "fs";
import path from "path";
import { debug } from "../utils/logger";
import { ConceroNetwork } from "@concero/contract-utils";
import { ChainRpcOutput, HealthyRpc } from "../types";

export function ensureDirectoriesExist(outputDir: string) {
  const mainnetDir = path.join(outputDir, "mainnet");
  const testnetDir = path.join(outputDir, "testnet");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (!fs.existsSync(mainnetDir)) {
    fs.mkdirSync(mainnetDir, { recursive: true });
  }

  if (!fs.existsSync(testnetDir)) {
    fs.mkdirSync(testnetDir, { recursive: true });
  }

  return { mainnetDir, testnetDir };
}

export function writeNetworkFile(
  directory: string,
  chainId: string,
  rpcs: HealthyRpc[],
  network: ConceroNetwork,
): string {
  const fileName = `${chainId}-${network.name}.json`;
  const outputPath = path.join(directory, fileName);

  const urls = rpcs.map(rpc => rpc.url);

  const chainOutput: ChainRpcOutput = {
    id: chainId,
    urls: urls,
    chainSelector: network.chainSelector,
    name: network.name,
  };

  fs.writeFileSync(outputPath, JSON.stringify(chainOutput, null, 2));
  return outputPath;
}

export function writeChainRpcFiles(
  rpcsByChain: Map<string, HealthyRpc[]>,
  outputDir: string,
  getNetworkForChain: (chainId: string) => {
    mainnetNetwork?: ConceroNetwork;
    testnetNetwork?: ConceroNetwork;
  },
  processMainnet: boolean = true,
  processTestnet: boolean = true,
): string[] {
  const { mainnetDir, testnetDir } = ensureDirectoriesExist(outputDir);
  const modifiedFiles: string[] = [];

  rpcsByChain.forEach((rpcs, chainId) => {
    const { mainnetNetwork, testnetNetwork } = getNetworkForChain(chainId);

    // Process mainnet network if it exists and is enabled
    if (mainnetNetwork && processMainnet) {
      const outputPath = writeNetworkFile(mainnetDir, chainId, rpcs, mainnetNetwork);
      modifiedFiles.push(outputPath);
    }

    // Process testnet network if it exists and is enabled
    if (testnetNetwork && processTestnet) {
      const outputPath = writeNetworkFile(testnetDir, chainId, rpcs, testnetNetwork);
      modifiedFiles.push(outputPath);
    }

    if ((!mainnetNetwork || !processMainnet) && (!testnetNetwork || !processTestnet)) {
      debug(`No applicable network configuration found for chain ID ${chainId}`);
    }
  });

  return modifiedFiles;
}
