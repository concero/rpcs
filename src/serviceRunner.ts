import fs from "fs";
import path from "path";
import simpleGit from "simple-git";
import { getChainSelector } from "./constants/conceroChainSelectors";
import config from "./constants/config";
import fetchChainlistRpcs from "./fetchers/fetchChainlistRpcs";
import { debug, error, info } from "./logger";
import { testRpcEndpoints } from "./rpcTester";
import { ChainRpcOutput, HealthyRpc, RpcEndpoint } from "./types";
export default async function runService() {
  try {
    info("Starting RPC service...");

    const extraRpcs = await fetchChainlistRpcs();
    debug(`Found ${Object.keys(extraRpcs).length} chains to process`);
    const allEndpoints: RpcEndpoint[] = [];

    for (const chainId of Object.keys(extraRpcs)) {
      const { rpcs } = extraRpcs[chainId];
      for (const rpc of rpcs) {

        allEndpoints.push({
          chainId,
          url: rpc
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

      const chainSelector = getChainSelector(chainId);
      const chainOutput: ChainRpcOutput = {
        id: chainId,
        urls: rpcs.map(rpc => rpc.url.replace("https://", "")),
        ...(chainSelector !== undefined && { chainSelector }),
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
