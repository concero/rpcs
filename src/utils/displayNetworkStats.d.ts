/**
 * Represents the essential chain statistics
 */
export interface ChainStats {
    name: string;
    chainId: string;
    healthyRpcCount: number;
    chainlistRpcCount: number;
    unhealthyChainlistCount: number;
    ethereumListsRpcCount: number;
    unhealthyEthereumListsCount: number;
}
/**
 * Displays network statistics in a formatted table
 */
export declare function displayNetworkStats(mainnetStats: ChainStats[], testnetStats: ChainStats[]): void;
