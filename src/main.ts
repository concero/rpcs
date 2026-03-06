import config from "./constants/config";
import { error, info } from "./utils/logger";
import { testRpcEndpoints } from "./services/rpcTester";
import { getSupportedChainIds } from "./utils/parsers";
import { commitAndPushChanges } from "./services/gitService";
import { HealthyRpc } from "./types";
import { fetchConceroNetworks } from "./services/conceroNetworks";
import { shouldCommitChanges } from "./utils/shouldCommitChanges";
import { StatsCollector } from "./utils/StatsCollector";
import { writeChainRpcFiles, writeValidatorConfigFiles } from "./services/fileService";
import { filterEndpoints } from "./utils/filterEndpoints";
import { fetchExternalEndpoints } from "./utils/fetchExternalEndpoints";
import { processTestResults } from "./utils/processTestResults";
import { overrideService } from "./services/overrideService";
import { testGetLogsBlockDepths } from "./services/blockDepthTester";
import { testBatchSupport } from "./services/batchRequestTester";
import { buildValidatorConfig } from "./utils/buildValidatorConfig";
import { buildAuditEntries, appendAuditEntries } from "./utils/auditLog";

/**
 * Main RPC service function that orchestrates the entire process:
 * 1. Fetch network details
 * 2. Fetch RPC endpoints from multiple sources
 * 3. Test endpoints for health and performance
 * 4. Process results and generate two output files: mainnet.json and testnet.json
 * 5. Commit changes to repository if configured
 *
 * @returns Map of chain IDs to their healthy RPC endpoints
 */
export async function main(): Promise<Map<string, HealthyRpc[]>> {
  try {
    info("Starting RPC service...");

    // 1. Fetch network configuration
    const networks = await fetchConceroNetworks();

    // Initialize stats collector
    const statsCollector = new StatsCollector(networks);
    statsCollector.initialize();
    const chainIds = getSupportedChainIds(networks);

    // 2. Fetch and filter endpoints
    const allEndpoints = await fetchExternalEndpoints(chainIds, networks);
    const uniqueEndpoints = filterEndpoints(allEndpoints);

    // 3. Test endpoints
    const testResult = await testRpcEndpoints(uniqueEndpoints, statsCollector);

    // 4. Process results
    const healthyRpcsByNetwork = processTestResults(testResult, networks);

    // 5. Apply overrides
    const rpcsByNetworkWithOverrides = await overrideService.applyOverrides(
      healthyRpcsByNetwork,
      networks,
    );

    // 6. Write output files
    const modifiedFiles = writeChainRpcFiles(
      rpcsByNetworkWithOverrides,
      config.OUTPUT_DIR,
      networks,
    );

    let batchSupportMap = new Map<string, HealthyRpc[]>();
    let batchErrors = new Map<string, string>();
    if (config.BATCH_TESTER.ENABLED) {
      ({ healthyRpcs: batchSupportMap, rpcErrors: batchErrors } = await testBatchSupport(
        testResult.healthyRpcs,
      ));
    }

    let blockDepthMap = new Map<string, HealthyRpc[]>();
    let depthErrors = new Map<string, string>();
    if (config.DEPTH_TESTER.ENABLED) {
      ({ healthyRpcs: blockDepthMap, rpcErrors: depthErrors } = await testGetLogsBlockDepths(
        testResult.healthyRpcs,
      ));
    }

    const { batchSupportMapWithOverrides, blockDepthMapWithOverrides } =
      await overrideService.applyValidatorOverrides(batchSupportMap, blockDepthMap, networks);

    if (config.BUILD_AUDIT_ENTRIES) {
      const auditEntries = buildAuditEntries(
        batchSupportMapWithOverrides,
        blockDepthMapWithOverrides,
        batchErrors,
        depthErrors,
        networks,
      );
      appendAuditEntries(auditEntries, config.OUTPUT_DIR);
    }

    const validatorConfig = buildValidatorConfig(
      blockDepthMapWithOverrides,
      batchSupportMapWithOverrides,
      rpcsByNetworkWithOverrides,
      networks,
    );

    writeValidatorConfigFiles(validatorConfig, config.OUTPUT_DIR, networks);

    // 7. Display statistics
    statsCollector.display();

    // 8. Optional: commit changes
    if (shouldCommitChanges(modifiedFiles)) {
      await commitAndPushChanges(config.GIT.REPO_PATH, modifiedFiles);
    }

    return healthyRpcsByNetwork;
  } catch (err) {
    error(`Service run error: ${String(err)}, ${err.stack}`);
    throw err;
  }
}
