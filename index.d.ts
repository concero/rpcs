export interface ChainRpcData {
    rpcUrls: string[];
    chainSelector: number;
    chainId: string;
}
export declare const mainnetChains: Record<string, ChainRpcData>;
export declare const testnetChains: Record<string, ChainRpcData>;
