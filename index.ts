import fs from "fs";
import path from "path";

export interface ChainRpcData {
  id: string;
  urls: string[];
  chainSelector: number;
  name: string;
}

export interface SupportedChains {
  mainnet: Record<string, string>;
  testnet: Record<string, string>;
}

const supportedChainsPath = path.join(__dirname, "output/supported-chains.json");
export const supportedChains: SupportedChains = JSON.parse(
  fs.readFileSync(supportedChainsPath, "utf-8"),
);

function loadChainData(): {
  mainnet: Record<string, ChainRpcData>;
  testnet: Record<string, ChainRpcData>;
  all: Record<string, ChainRpcData>;
} {
  const mainnetChains: Record<string, ChainRpcData> = {};
  const testnetChains: Record<string, ChainRpcData> = {};
  const allChains: Record<string, ChainRpcData> = {};

  Object.entries(supportedChains.mainnet).forEach(([chainId, name]) => {
    const filePath = path.join(__dirname, `output/mainnet/${chainId}-${name}.json`);
    if (fs.existsSync(filePath)) {
      const chainData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      mainnetChains[chainId] = chainData;
      allChains[chainId] = chainData;
    }
  });

  Object.entries(supportedChains.testnet).forEach(([chainId, name]) => {
    const filePath = path.join(__dirname, `output/testnet/${chainId}-${name}.json`);
    if (fs.existsSync(filePath)) {
      const chainData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      testnetChains[chainId] = chainData;
      allChains[chainId] = chainData;
    }
  });

  return {
    mainnet: mainnetChains,
    testnet: testnetChains,
    all: allChains,
  };
}

const chainData = loadChainData();
export const mainnetChains = chainData.mainnet;
export const testnetChains = chainData.testnet;
export const allChains = chainData.all;
