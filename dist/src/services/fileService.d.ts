import { HealthyRpc } from "../types";
import { NetworkDetails } from "./networkService";
export declare function ensureDirectoriesExist(outputDir: string): {
    mainnetDir: string;
    testnetDir: string;
};
export declare function writeNetworkFile(directory: string, chainId: string, rpcs: HealthyRpc[], network: NetworkDetails): string;
export declare function writeChainRpcFiles(rpcsByChain: Map<string, HealthyRpc[]>, outputDir: string, getNetworkForChain: (chainId: string) => {
    mainnetNetwork?: NetworkDetails;
    testnetNetwork?: NetworkDetails;
}, processMainnet?: boolean, processTestnet?: boolean): string[];
export declare function generateSupportedChainsFile(networkDetails: Record<string, NetworkDetails>): void;
