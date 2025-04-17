import { NetworkDetails, NetworkData } from "../types";
export declare function fetchNetworksData(isMainnet: boolean): Promise<NetworkData>;
export declare function fetchNetworkDetails(networkName: string, isMainnet: boolean): Promise<NetworkDetails | null>;
export declare function fetchAllNetworkDetails(): Promise<Record<string, NetworkDetails>>;
