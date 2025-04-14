import { ChainStats } from "../types";
import { info } from "./logger";
export function displayNetworkStats(mainnetStats: ChainStats[], testnetStats: ChainStats[]) {
  // Sort stats by chain name
  mainnetStats.sort((a, b) => a.name.localeCompare(b.name));
  testnetStats.sort((a, b) => a.name.localeCompare(b.name));

  if (mainnetStats.length > 0) {
    info("=== Mainnet Chains ===");
    console.table(
      mainnetStats.map(stat => ({
        Chain: stat.name.length > 15 ? stat.name.substring(0, 12) + "..." : stat.name,
        ID: stat.chainId,
        "Total Healthy": stat.healthyRpcCount,
        "CL (Healthy/Failed)": `${stat.chainlistRpcCount}/${stat.unhealthyChainlistCount}`,
        "EL (Healthy/Failed)": `${stat.ethereumListsRpcCount}/${stat.unhealthyEthereumListsCount}`,
      })),
    );
  }

  if (testnetStats.length > 0) {
    info("=== Testnet Chains ===");
    console.table(
      testnetStats.map(stat => ({
        Chain: stat.name.length > 15 ? stat.name.substring(0, 12) + "..." : stat.name,
        ID: stat.chainId,
        "Total Healthy": stat.healthyRpcCount,
        "CL (Healthy/Failed)": `${stat.chainlistRpcCount}/${stat.unhealthyChainlistCount}`,
        "EL (Healthy/Failed)": `${stat.ethereumListsRpcCount}/${stat.unhealthyEthereumListsCount}`,
      })),
    );
  }

  // Summary statistics table is removed as requested
}
