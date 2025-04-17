"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayNetworkStats = displayNetworkStats;
const logger_1 = require("./logger");
/**
 * Displays network statistics in a formatted table
 */
function displayNetworkStats(mainnetStats, testnetStats) {
    mainnetStats.sort((a, b) => a.name.localeCompare(b.name));
    testnetStats.sort((a, b) => a.name.localeCompare(b.name));
    displayChainTypeStats(mainnetStats, "Mainnet", true);
    displayChainTypeStats(testnetStats, "Testnet", false);
}
/**
 * Displays statistics for a specific chain type
 */
function displayChainTypeStats(stats, networkType, isMainnet) {
    if (stats.length === 0)
        return;
    (0, logger_1.info)(`=== ${networkType} Chains ===`);
    console.table(stats.map(stat => ({
        Chain: stat.name.length > 15 ? stat.name.substring(0, 12) + "..." : stat.name,
        ID: stat.chainId,
        "Total Healthy": stat.healthyRpcCount,
        "CL (Healthy/Failed)": `${stat.chainlistRpcCount}/${stat.unhealthyChainlistCount}`,
        "EL (Healthy/Failed)": `${stat.ethereumListsRpcCount}/${stat.unhealthyEthereumListsCount}`,
    })));
    const unhealthyNetworks = stats.filter(stat => stat.healthyRpcCount === 0);
    if (unhealthyNetworks.length > 0) {
        const logMethod = isMainnet ? logger_1.info : logger_1.warn;
        logMethod(`\x1b[31mWarning: The following ${networkType.toLowerCase()} networks have no healthy RPCs:\x1b[0m`);
        unhealthyNetworks.forEach(network => {
            (0, logger_1.info)(`  \x1b[31m- ${network.name} (Chain ID: ${network.chainId})\x1b[0m`);
        });
    }
}
