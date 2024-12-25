// runService.ts
import fs from "fs";
import path from "path";
import simpleGit from "simple-git";
import logger from "./logger";
import config from "./config";
import fetchChainlistRpcs from "./fetchers/fetchChainlistRpcs";
import { testRpcEndpoints, HealthyRpc, RpcEndpoint } from "./rpcTester";

export interface HealthyRpcsByChain {
    [chainId: string]: {
        rpcs: HealthyRpc[];
    };
}

export default async function runService() {
    try {
        const extraRpcs = await fetchChainlistRpcs();
        const allEndpoints: RpcEndpoint[] = [];
        for (const chainId of Object.keys(extraRpcs)) {
            const { rpcs } = extraRpcs[chainId];
            for (const rpc of rpcs as RpcEndpoint[]) {
                allEndpoints.push({
                    chainId,
                    url: rpc.url,
                });
            }
        }

        const tested = await testRpcEndpoints(allEndpoints);
        const healthyRpcsByChain: HealthyRpcsByChain = {};
        for (const healthy of tested) {
            const { chainId } = healthy;
            if (!healthyRpcsByChain[chainId]) {
                healthyRpcsByChain[chainId] = { rpcs: [] };
            }
            healthyRpcsByChain[chainId].rpcs.push(healthy);
        }

        const outputDir = path.dirname(config.HEALTHY_RPCS_FILE);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.writeFileSync(
            config.HEALTHY_RPCS_FILE,
            JSON.stringify(healthyRpcsByChain, null, 2),
        );

        const git = simpleGit(config.GIT_REPO_PATH);
        await git.add(config.HEALTHY_RPCS_FILE);
        await git.commit(
            `Update healthy-rpcs.json ${new Date().toISOString()}`,
        );
        await git.push();

        return healthyRpcsByChain;
    } catch (err) {
        logger.error(`Service run error: ${String(err)}`);
        throw err;
    }
}
