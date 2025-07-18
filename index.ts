import * as fs from "fs";
import * as path from "path";

export interface ChainRpcData {
  id: string;
  urls: string[];
  chainSelector: number;
  name: string;
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
    Object.entries(mainnetData).forEach(([chainId, data]) => {
      const chainData = data as Omit<ChainRpcData, "id">;
      const fullChainData: ChainRpcData = {
        id: chainId,
        urls: chainData.urls,
        chainSelector: chainData.chainSelector,
        name: chainData.name,
      };
      mainnetChains[chainId] = fullChainData;
    });
  }

  if (fs.existsSync(testnetPath)) {
    const testnetData = JSON.parse(fs.readFileSync(testnetPath, "utf-8"));
    Object.entries(testnetData).forEach(([chainId, data]) => {
      const chainData = data as Omit<ChainRpcData, "id">;
      const fullChainData: ChainRpcData = {
        id: chainId,
        urls: chainData.urls,
        chainSelector: chainData.chainSelector,
        name: chainData.name,
      };
      testnetChains[chainId] = fullChainData;
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
