import * as fs from "fs";
import * as path from "path";

export interface ChainRpcData {
  rpcUrls: string[];
  chainSelector: number;
  chainId: string;
}

function loadChainData(): {
  mainnet: Record<string, ChainRpcData>;
  testnet: Record<string, ChainRpcData>;
} {
  const mainnetPath = path.join(__dirname, "output/mainnet.json");
  const testnetPath = path.join(__dirname, "output/testnet.json");

  const mainnetChains: Record<string, ChainRpcData> = {};
  const testnetChains: Record<string, ChainRpcData> = {};

  if (fs.existsSync(mainnetPath)) {
    const mainnetData = JSON.parse(fs.readFileSync(mainnetPath, "utf-8"));
    Object.entries(mainnetData).forEach(([chainKey, data]) => {
      mainnetChains[chainKey] = data as ChainRpcData;
    });
  }

  if (fs.existsSync(testnetPath)) {
    const testnetData = JSON.parse(fs.readFileSync(testnetPath, "utf-8"));
    Object.entries(testnetData).forEach(([chainKey, data]) => {
      testnetChains[chainKey] = data as ChainRpcData;
    });
  }

  return {
    mainnet: mainnetChains,
    testnet: testnetChains,
  };
}

const chainData = loadChainData();
export const mainnetChains = chainData.mainnet;
export const testnetChains = chainData.testnet;
