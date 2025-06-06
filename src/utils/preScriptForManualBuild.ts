import { promises as fs } from "fs";
import * as path from "path";

interface ChainsInput {
  mainnet: Record<string, string>;
  testnet: Record<string, string>;
}

interface ChainFile {
  id: string;
  urls: string[];
  chainSelector: number;
  name: string;
}

async function generateChainFiles() {
  try {
    const inputFilePath = path.join(__dirname, "../../output/", "supported-chains.json");
    const rawData = await fs.readFile(inputFilePath, "utf-8");
    const allChains: ChainsInput = JSON.parse(rawData);

    async function writeChainFile(chainId: string, chainName: string) {
      const fileName = `${chainId}-${chainName}.json`;
      const filePath = path.join(__dirname, "../../output/testnet/", fileName);

      try {
        await fs.access(filePath);
        console.log(`File already exists, skipping: ${fileName}`);
        return;
      } catch {}

      const chainObj: ChainFile = {
        id: chainId,
        urls: [],
        chainSelector: Number(chainId),
        name: chainName,
      };

      await fs.writeFile(filePath, JSON.stringify(chainObj, null, 2), "utf-8");
      console.log(`File created: ${fileName}`);
    }

    for (const [chainId, chainName] of Object.entries(allChains.testnet)) {
      await writeChainFile(chainId, chainName);
    }

    console.log("All chain files have been generated successfully.");
  } catch (err) {
    console.error(err);
  }
}

generateChainFiles();
