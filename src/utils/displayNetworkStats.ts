import { info, warn } from "./logger";

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
export function displayNetworkStats(mainnetStats: ChainStats[], testnetStats: ChainStats[]) {
  mainnetStats.sort((a, b) => a.name.localeCompare(b.name));
  testnetStats.sort((a, b) => a.name.localeCompare(b.name));

  displayChainTypeStats(mainnetStats, "Mainnet", true);
  displayChainTypeStats(testnetStats, "Testnet", false);
}

/**
 * Displays statistics for a specific chain type
 */
function displayChainTypeStats(stats: ChainStats[], networkType: string, isMainnet: boolean) {
  if (stats.length === 0) return;

  info(`=== ${networkType} Chains ===`);

  console.table(
    stats.map(stat => ({
      Chain: stat.name.length > 15 ? stat.name.substring(0, 12) + "..." : stat.name,
      ID: stat.chainId,
      "Total Healthy": stat.healthyRpcCount,
      "CL (Healthy/Failed)": `${stat.chainlistRpcCount}/${stat.unhealthyChainlistCount}`,
      "EL (Healthy/Failed)": `${stat.ethereumListsRpcCount}/${stat.unhealthyEthereumListsCount}`,
    })),
  );

  const unhealthyNetworks = stats.filter(stat => stat.healthyRpcCount === 0);
  if (unhealthyNetworks.length > 0) {
    const logMethod = isMainnet ? info : warn;
    logMethod(
      `\x1b[31mWarning: The following ${networkType.toLowerCase()} networks have no healthy RPCs:\x1b[0m`,
    );
    unhealthyNetworks.forEach(network => {
      info(`  \x1b[31m- ${network.name} (Chain ID: ${network.chainId})\x1b[0m`);
    });
  }
}
