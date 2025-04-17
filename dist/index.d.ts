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
export declare const supportedChains: SupportedChains;
export declare const mainnetChains: Record<string, ChainRpcData>;
export declare const testnetChains: Record<string, ChainRpcData>;
export declare const allChains: Record<string, ChainRpcData>;
