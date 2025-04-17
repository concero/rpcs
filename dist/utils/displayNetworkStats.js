import { info, warn } from "./logger";
export function displayNetworkStats(mainnetStats, testnetStats) {
    mainnetStats.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });
    testnetStats.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });
    if (mainnetStats.length > 0) {
        info("=== Mainnet Chains ===");
        // First display the table
        console.table(mainnetStats.map(function(stat) {
            return {
                Chain: stat.name.length > 15 ? stat.name.substring(0, 12) + "..." : stat.name,
                ID: stat.chainId,
                "Total Healthy": stat.healthyRpcCount,
                "CL (Healthy/Failed)": "".concat(stat.chainlistRpcCount, "/").concat(stat.unhealthyChainlistCount),
                "EL (Healthy/Failed)": "".concat(stat.ethereumListsRpcCount, "/").concat(stat.unhealthyEthereumListsCount)
            };
        }));
        // Then separately highlight networks with no healthy RPCs
        var unhealthyNetworks = mainnetStats.filter(function(stat) {
            return stat.healthyRpcCount === 0;
        });
        if (unhealthyNetworks.length > 0) {
            info("\x1b[31mWarning: The following mainnet networks have no healthy RPCs:\x1b[0m");
            unhealthyNetworks.forEach(function(network) {
                info("  \x1b[31m- ".concat(network.name, " (Chain ID: ").concat(network.chainId, ")\x1b[0m"));
            });
        }
    }
    if (testnetStats.length > 0) {
        info("=== Testnet Chains ===");
        // First display the table
        console.table(testnetStats.map(function(stat) {
            return {
                Chain: stat.name.length > 15 ? stat.name.substring(0, 12) + "..." : stat.name,
                ID: stat.chainId,
                "Total Healthy": stat.healthyRpcCount,
                "CL (Healthy/Failed)": "".concat(stat.chainlistRpcCount, "/").concat(stat.unhealthyChainlistCount),
                "EL (Healthy/Failed)": "".concat(stat.ethereumListsRpcCount, "/").concat(stat.unhealthyEthereumListsCount)
            };
        }));
        // Then separately highlight networks with no healthy RPCs
        var unhealthyNetworks1 = testnetStats.filter(function(stat) {
            return stat.healthyRpcCount === 0;
        });
        if (unhealthyNetworks1.length > 0) {
            warn("\x1b[31mThe following testnet networks have no healthy RPCs:\x1b[0m");
            unhealthyNetworks1.forEach(function(network) {
                info("  \x1b[31m- ".concat(network.name, " (Chain ID: ").concat(network.chainId, ")\x1b[0m"));
            });
        }
    }
}
