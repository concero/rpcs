import { ChainStats } from "../types";
import { info, warn } from "./logger";

export function displayNetworkStats(mainnetStats: ChainStats[], testnetStats: ChainStats[]) {
  mainnetStats.sort((a, b) => a.name.localeCompare(b.name));
  testnetStats.sort((a, b) => a.name.localeCompare(b.name));

  if (mainnetStats.length > 0) {
    info("=== Mainnet Chains ===");

    // First display the table
    console.table(
      mainnetStats.map(stat => ({
        Chain: stat.name.length > 15 ? stat.name.substring(0, 12) + "..." : stat.name,
        ID: stat.chainId,
        "Total Healthy": stat.healthyRpcCount,
        "CL (Healthy/Failed)": `${stat.chainlistRpcCount}/${stat.unhealthyChainlistCount}`,
        "EL (Healthy/Failed)": `${stat.ethereumListsRpcCount}/${stat.unhealthyEthereumListsCount}`,
      })),
    );

    // Then separately highlight networks with no healthy RPCs
    const unhealthyNetworks = mainnetStats.filter(stat => stat.healthyRpcCount === 0);
    if (unhealthyNetworks.length > 0) {
      info("\x1b[31mWarning: The following mainnet networks have no healthy RPCs:\x1b[0m");
      unhealthyNetworks.forEach(network => {
        info(`  \x1b[31m- ${network.name} (Chain ID: ${network.chainId})\x1b[0m`);
      });
    }
  }

  if (testnetStats.length > 0) {
    info("=== Testnet Chains ===");

    // First display the table
    console.table(
      testnetStats.map(stat => ({
        Chain: stat.name.length > 15 ? stat.name.substring(0, 12) + "..." : stat.name,
        ID: stat.chainId,
        "Total Healthy": stat.healthyRpcCount,
        "CL (Healthy/Failed)": `${stat.chainlistRpcCount}/${stat.unhealthyChainlistCount}`,
        "EL (Healthy/Failed)": `${stat.ethereumListsRpcCount}/${stat.unhealthyEthereumListsCount}`,
      })),
    );

    // Then separately highlight networks with no healthy RPCs
    const unhealthyNetworks = testnetStats.filter(stat => stat.healthyRpcCount === 0);
    if (unhealthyNetworks.length > 0) {
      warn("\x1b[31mThe following testnet networks have no healthy RPCs:\x1b[0m");
      unhealthyNetworks.forEach(network => {
        info(`  \x1b[31m- ${network.name} (Chain ID: ${network.chainId})\x1b[0m`);
      });
    }
  }
}
