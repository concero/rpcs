export interface NetworkData {
    [networkName: string]: {
        chainId: number;
        chainSelector: number;
    };
}
export interface NetworkDetails {
    name: string;
    chainId: number;
    chainSelector: number;
    rpcs: string[];
    blockExplorers: {
        name: string;
        url: string;
        apiUrl: string;
    }[];
    faucets: string[];
    networkType: "mainnet" | "testnet";
}
export declare function fetchNetworksData(isMainnet: boolean): Promise<NetworkData>;
export declare function fetchNetworkDetails(networkName: string, isMainnet: boolean): Promise<NetworkDetails | null>;
export declare function fetchAllNetworkDetails(): Promise<Record<string, NetworkDetails>>;
