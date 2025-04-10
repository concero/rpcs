import fs from "fs";
import path from "path";
import simpleGit from "simple-git";
import config from "./constants/config";
import { mainnetNetworks, testnetNetworks } from "@concero/contract-utils";
import fetchChainlistRpcs from "./fetchers/fetchChainlistRpcs";
import { debug, error, info } from "./logger";
import { testRpcEndpoints } from "./rpcTester";
import { ChainRpcOutput, HealthyRpc, RpcEndpoint } from "./types";

export default async function runService() {
  try {
    info("Starting RPC service...");

    // Determine which networks to use based on config
    const conceroNetworks = config.USE_MAINNET ? mainnetNetworks : testnetNetworks;

    // Get chainIds from conceroNetworks
    const supportedChainIds = Object.values(conceroNetworks).map(network =>
      network.chainId.toString(),
    );

    info(
      `Using ${config.USE_MAINNET ? "mainnet" : "testnet"} networks. Supported chain IDs: ${supportedChainIds.join(", ")}`,
    );

    const extraRpcs = await fetchChainlistRpcs();

    // Filter by supported chain IDs and exclude ignored chains
    const filteredRpcs = Object.fromEntries(
      Object.entries(extraRpcs).filter(
        ([chainId]) =>
          supportedChainIds.includes(chainId) &&
          !config.IGNORE_CHAIN_IDS.includes(parseInt(chainId, 10)),
      ),
    );

    debug(
      `Found ${Object.keys(filteredRpcs).length} chains to process out of ${Object.keys(extraRpcs).length} total chains`,
    );
    const allEndpoints: RpcEndpoint[] = [];

    for (const chainId of Object.keys(filteredRpcs)) {
      const { rpcs } = filteredRpcs[chainId];
      for (const rpc of rpcs) {
        allEndpoints.push({
          chainId,
          url: rpc,
        });
      }
    }

    const tested = await testRpcEndpoints(allEndpoints);

    if (!fs.existsSync(config.OUTPUT_DIR)) {
      fs.mkdirSync(config.OUTPUT_DIR, { recursive: true });
    }

    const rpcsByChain = new Map<string, HealthyRpc[]>();
    for (const rpc of tested) {
      if (!rpcsByChain.has(rpc.chainId)) {
        rpcsByChain.set(rpc.chainId, []);
      }
      rpcsByChain.get(rpc.chainId)!.push(rpc);
    }

    const responseTimeMap = new Map<string, number>();

    const modifiedFiles: string[] = [];
    for (const [chainId, rpcs] of rpcsByChain.entries()) {
      const outputPath = path.join(config.OUTPUT_DIR, `${chainId}.json`);

      rpcs.sort((a, b) => a.responseTime - b.responseTime);

      rpcs.forEach(rpc => {
        responseTimeMap.set(rpc.url, rpc.responseTime);
      });

      // Find the network in conceroNetworks
      const network = Object.values(conceroNetworks).find(
        network => network.chainId.toString() === chainId,
      );

      if (!network) {
        debug(`No network configuration found for chain ID ${chainId}`);
        continue;
      }

      const chainOutput: ChainRpcOutput = {
        id: chainId,
        urls: rpcs.map(rpc => rpc.url.replace("https://", "")),
        chainSelector: network.chainSelector,
        name: network.name,
      };

      fs.writeFileSync(outputPath, JSON.stringify(chainOutput, null, 2));
      modifiedFiles.push(outputPath);
    }

    // Git operations
    const git = simpleGit(config.GIT_REPO_PATH);
    await git.add(modifiedFiles);
    await git.commit(`Update chain RPC files ${new Date().toISOString()}`);
    await git.push();

    info("Service run complete");
    return rpcsByChain;
  } catch (err) {
    error(`Service run error: ${String(err)}`);
    throw err;
  }
}
