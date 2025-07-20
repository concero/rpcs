import { HealthyRpc, NetworkDetails } from "../types";
import { info } from "./logger";

interface ChainStat {
  chainId: string;
  name: string;
  networkType: "mainnet" | "testnet";
  healthy: number;
  unhealthy: number;
  bySource: {
    chainlist: number;
    "ethereum-lists": number;
    "v2-networks": number;
  };
}

/**
 * Simplified statistics collector for RPC testing
 * Collects statistics during processing rather than after
 */
export class StatsCollector {
  private stats = new Map<string, ChainStat>();
  private totalTested = 0;
  private totalHealthy = 0;

  constructor(private networkDetails: Record<string, NetworkDetails>) {}

  /**
   * Initialize stats for all known networks
   */
  initialize(): void {
    Object.values(this.networkDetails).forEach(network => {
      this.stats.set(network.chainId.toString(), {
        chainId: network.chainId.toString(),
        name: network.name,
        networkType: network.networkType,
        healthy: 0,
        unhealthy: 0,
        bySource: {
          chainlist: 0,
          "ethereum-lists": 0,
          "v2-networks": 0,
        },
      });
    });
  }

  /**
   * Record an endpoint being tested
   */
  recordTest(): void {
    this.totalTested++;
  }

  /**
   * Record a healthy RPC endpoint
   */
  recordHealthy(rpc: HealthyRpc): void {
    const stat = this.getOrCreateStat(rpc.chainId);
    stat.healthy++;
    stat.bySource[rpc.source]++;
    this.totalHealthy++;
  }

  /**
   * Record an unhealthy RPC endpoint
   */
  recordUnhealthy(chainId: string): void {
    const stat = this.getOrCreateStat(chainId);
    stat.unhealthy++;
  }

  /**
   * Get or create stats for a chain
   */
  private getOrCreateStat(chainId: string): ChainStat {
    let stat = this.stats.get(chainId);
    if (!stat) {
      // Find network details for this chain
      const network = Object.values(this.networkDetails).find(
        n => n.chainId.toString() === chainId,
      );

      stat = {
        chainId,
        name: network?.name || `Unknown (${chainId})`,
        networkType: network?.networkType || "mainnet",
        healthy: 0,
        unhealthy: 0,
        bySource: {
          chainlist: 0,
          "ethereum-lists": 0,
          "v2-networks": 0,
        },
      };
      this.stats.set(chainId, stat);
    }
    return stat;
  }

  /**
   * Display statistics summary
   */
  display(): void {
    const mainnetStats: ChainStat[] = [];
    const testnetStats: ChainStat[] = [];

    // Separate by network type
    this.stats.forEach(stat => {
      if (stat.networkType === "mainnet") {
        mainnetStats.push(stat);
      } else {
        testnetStats.push(stat);
      }
    });

    // Sort by healthy count (descending)
    mainnetStats.sort((a, b) => b.healthy - a.healthy);
    testnetStats.sort((a, b) => b.healthy - a.healthy);

    info("=== RPC Testing Summary ===");
    info(`Total endpoints tested: ${this.totalTested}`);
    info(`Total healthy endpoints: ${this.totalHealthy}`);
    info(`Success rate: ${((this.totalHealthy / this.totalTested) * 100).toFixed(1)}%`);

    info("\n=== Mainnet Networks ===");
    this.displayNetworkStats(mainnetStats, "mainnet");

    info("\n=== Testnet Networks ===");
    this.displayNetworkStats(testnetStats, "testnet");
  }

  /**
   * Display statistics for a list of networks
   */
  private displayNetworkStats(stats: ChainStat[], networkType: string): void {
    // Prepare data for console.table
    const tableData = stats.map(stat => ({
      Network: stat.name,
      Healthy: stat.healthy,
      Unhealthy: stat.unhealthy,
      Chainlist: stat.bySource.chainlist,
      "Ethereum-Lists": stat.bySource["ethereum-lists"],
      "V2-Networks": stat.bySource["v2-networks"],
    }));

    // Sort by healthy count (descending), then by name
    tableData.sort((a, b) => {
      if (b.Healthy !== a.Healthy) return b.Healthy - a.Healthy;
      return a.Network.localeCompare(b.Network);
    });

    // Display the table
    console.table(tableData);
  }

  /**
   * Get statistics for export/further processing
   */
  getStats(): Map<string, ChainStat> {
    return new Map(this.stats);
  }

  /**
   * Get summary statistics
   */
  getSummary(): { total: number; healthy: number; successRate: number } {
    return {
      total: this.totalTested,
      healthy: this.totalHealthy,
      successRate: this.totalTested > 0 ? (this.totalHealthy / this.totalTested) * 100 : 0,
    };
  }
}
