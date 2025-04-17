"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRpcService = runRpcService;
const config_1 = __importDefault(require("../constants/config"));
const chainlistService_1 = require("./chainlistService");
const ethereumListsService_1 = require("./ethereumListsService");
const logger_1 = require("../utils/logger");
const rpcTester_1 = require("./rpcTester");
const chainService_1 = require("./chainService");
const fileService_1 = require("./fileService");
const gitService_1 = require("./gitService");
const displayNetworkStats_1 = require("../utils/displayNetworkStats");
const sanitizeUrl_1 = require("../utils/sanitizeUrl");
const networkService_1 = require("./networkService");
async function runRpcService() {
    try {
        (0, logger_1.info)("Starting RPC service...");
        const networkDetails = await (0, networkService_1.fetchAllNetworkDetails)();
        const supportedChainIds = (0, chainService_1.getSupportedChainIds)(networkDetails);
        (0, logger_1.info)(`Supported chain IDs: ${supportedChainIds.join(", ")}`);
        const endpoints = await fetchEndpoints(supportedChainIds, networkDetails);
        const dedupedEndpoints = deduplicateEndpoints(endpoints);
        (0, logger_1.info)(`Testing ${dedupedEndpoints.length} unique endpoints (${endpoints.chainlist.length} from chainlist, ` +
            `${endpoints.ethereumLists.length} from ethereum-lists, ${endpoints.v2Networks.length} from v2-networks, ` +
            `${endpoints.total - dedupedEndpoints.length} duplicates removed)`);
        const testResult = await (0, rpcTester_1.testRpcEndpoints)(dedupedEndpoints);
        const results = processTestResults(testResult, networkDetails, endpoints.initialCollection);
        const modifiedFiles = writeOutputFiles(results, networkDetails);
        generateStatistics(results);
        if (shouldCommitChanges(modifiedFiles)) {
            await (0, gitService_1.commitAndPushChanges)(config_1.default.GIT_REPO_PATH, modifiedFiles);
        }
        (0, logger_1.info)("Service run complete");
        return results.healthyRpcs;
    }
    catch (err) {
        (0, logger_1.error)(`Service run error: ${String(err)}`);
        throw err;
    }
}
async function fetchEndpoints(supportedChainIds, networkDetails) {
    const rawChainlistRpcs = await (0, chainlistService_1.fetchChainlistRpcs)();
    const parsedChainlistRpcs = (0, chainlistService_1.parseChainlistRpcs)(rawChainlistRpcs);
    const filteredChainlistRpcs = (0, chainService_1.filterChainlistChains)(parsedChainlistRpcs, supportedChainIds);
    const ethereumListsChains = await (0, ethereumListsService_1.fetchEthereumListsChains)(supportedChainIds);
    const filteredEthereumListsChains = (0, chainService_1.filterEthereumListsChains)(ethereumListsChains, supportedChainIds);
    (0, logger_1.debug)(`Found ${Object.keys(filteredChainlistRpcs).length} chains from chainlist and ` +
        `${Object.keys(filteredEthereumListsChains).length} chains from ethereum-lists to process`);
    const chainlistEndpoints = (0, chainService_1.extractChainlistEndpoints)(filteredChainlistRpcs);
    const ethereumListsEndpoints = (0, chainService_1.extractEthereumListsEndpoints)(filteredEthereumListsChains);
    const networkEndpoints = (0, chainService_1.extractNetworkEndpoints)(networkDetails);
    const initialEndpoints = createInitialEndpointCollection(chainlistEndpoints, ethereumListsEndpoints, networkEndpoints);
    return {
        chainlist: chainlistEndpoints,
        ethereumLists: ethereumListsEndpoints,
        v2Networks: networkEndpoints,
        total: chainlistEndpoints.length + ethereumListsEndpoints.length + networkEndpoints.length,
        initialCollection: initialEndpoints,
    };
}
function createInitialEndpointCollection(chainlistEndpoints, ethereumListsEndpoints, networkEndpoints) {
    const initialEndpoints = {
        chainlist: new Map(),
        ethereumLists: new Map(),
        v2Networks: new Map(),
    };
    const addToCollection = (endpoint, collection) => {
        if (!collection.has(endpoint.chainId)) {
            collection.set(endpoint.chainId, []);
        }
        collection.get(endpoint.chainId).push(endpoint);
    };
    chainlistEndpoints.forEach(endpoint => {
        addToCollection(endpoint, initialEndpoints.chainlist);
    });
    ethereumListsEndpoints.forEach(endpoint => {
        addToCollection(endpoint, initialEndpoints.ethereumLists);
    });
    networkEndpoints.forEach(endpoint => {
        addToCollection(endpoint, initialEndpoints.v2Networks);
    });
    return initialEndpoints;
}
function deduplicateEndpoints(endpoints) {
    const urlMap = new Map();
    const allEndpointsArray = [
        ...endpoints.chainlist,
        ...endpoints.ethereumLists,
        ...endpoints.v2Networks,
    ];
    allEndpointsArray.forEach(endpoint => {
        const sanitizedUrl = (0, sanitizeUrl_1.sanitizeUrl)(endpoint.url);
        endpoint.url = sanitizedUrl;
        if (!urlMap.has(sanitizedUrl) ||
            (endpoint.source === "chainlist" && urlMap.get(sanitizedUrl)?.source === "ethereum-lists") ||
            endpoint.source === "v2-networks") {
            urlMap.set(sanitizedUrl, endpoint);
        }
    });
    return Array.from(urlMap.values());
}
function processTestResults(testResult, networkDetails, initialEndpoints) {
    if (testResult.chainIdMismatches.size > 0) {
        (0, logger_1.info)("=== Chain ID Mismatches ===");
        testResult.chainIdMismatches.forEach((returnedIds, expectedId) => {
            (0, logger_1.info)(`Chain ID ${expectedId} had mismatches: ${returnedIds.join(", ")}`);
        });
    }
    const rpcsByReturnedChainId = new Map();
    testResult.healthyRpcs.forEach(rpc => {
        if (!rpcsByReturnedChainId.has(rpc.returnedChainId)) {
            rpcsByReturnedChainId.set(rpc.returnedChainId, []);
        }
        rpcsByReturnedChainId.get(rpc.returnedChainId).push(rpc);
    });
    rpcsByReturnedChainId.forEach(rpcs => rpcs.sort((a, b) => a.responseTime - b.responseTime));
    const shouldProcessMainnet = config_1.default.NETWORK_MODE === 1 || config_1.default.NETWORK_MODE === 2;
    const shouldProcessTestnet = config_1.default.NETWORK_MODE === 0 || config_1.default.NETWORK_MODE === 2;
    const filteredSortedRpcs = new Map(Array.from(rpcsByReturnedChainId.entries()).filter(([chainId]) => {
        const network = (0, chainService_1.getNetworkDetails)(chainId, networkDetails);
        if (!network)
            return false;
        const isMainnet = network.networkType === "mainnet";
        return (isMainnet && shouldProcessMainnet) || (!isMainnet && shouldProcessTestnet);
    }));
    return {
        healthyRpcs: filteredSortedRpcs,
        networkDetails,
        initialEndpoints,
    };
}
function writeOutputFiles(results, networkDetails) {
    const shouldProcessMainnet = config_1.default.NETWORK_MODE === 1 || config_1.default.NETWORK_MODE === 2;
    const shouldProcessTestnet = config_1.default.NETWORK_MODE === 0 || config_1.default.NETWORK_MODE === 2;
    const modifiedFiles = (0, fileService_1.writeChainRpcFiles)(results.healthyRpcs, config_1.default.OUTPUT_DIR, chainId => {
        const network = (0, chainService_1.getNetworkDetails)(chainId, networkDetails);
        if (!network)
            return {};
        return {
            mainnetNetwork: network.networkType === "mainnet" ? network : undefined,
            testnetNetwork: network.networkType === "testnet" ? network : undefined,
        };
    }, shouldProcessMainnet, shouldProcessTestnet);
    (0, fileService_1.generateSupportedChainsFile)(networkDetails);
    return modifiedFiles;
}
function generateStatistics(results) {
    const mainnetStats = [];
    const testnetStats = [];
    const processedChainIds = new Set();
    const shouldProcessMainnet = config_1.default.NETWORK_MODE === 1 || config_1.default.NETWORK_MODE === 2;
    const shouldProcessTestnet = config_1.default.NETWORK_MODE === 0 || config_1.default.NETWORK_MODE === 2;
    results.healthyRpcs.forEach((rpcs, chainId) => {
        const network = (0, chainService_1.getNetworkDetails)(chainId, results.networkDetails);
        if (!network)
            return;
        processedChainIds.add(chainId);
        const isMainnet = network.networkType === "mainnet";
        const chainlistRpcs = rpcs.filter(rpc => rpc.source === "chainlist");
        const ethereumListsRpcs = rpcs.filter(rpc => rpc.source === "ethereum-lists");
        const initialChainlistCount = results.initialEndpoints.chainlist.get(chainId)?.length || 0;
        const initialEthereumListsCount = results.initialEndpoints.ethereumLists.get(chainId)?.length || 0;
        const unhealthyChainlistCount = initialChainlistCount - chainlistRpcs.length;
        const unhealthyEthereumListsCount = initialEthereumListsCount - ethereumListsRpcs.length;
        const stats = {
            chainId,
            name: network.name,
            healthyRpcCount: rpcs.length,
            chainlistRpcCount: chainlistRpcs.length,
            unhealthyChainlistCount,
            ethereumListsRpcCount: ethereumListsRpcs.length,
            unhealthyEthereumListsCount,
        };
        if (isMainnet && shouldProcessMainnet) {
            mainnetStats.push(stats);
        }
        else if (!isMainnet && shouldProcessTestnet) {
            testnetStats.push(stats);
        }
    });
    addMissingNetworksToStats(results.networkDetails, processedChainIds, results.initialEndpoints, mainnetStats, testnetStats);
    (0, displayNetworkStats_1.displayNetworkStats)(mainnetStats, testnetStats);
}
function addMissingNetworksToStats(networkDetails, processedChainIds, initialEndpoints, mainnetStats, testnetStats) {
    const shouldProcessMainnet = config_1.default.NETWORK_MODE === 1 || config_1.default.NETWORK_MODE === 2;
    const shouldProcessTestnet = config_1.default.NETWORK_MODE === 0 || config_1.default.NETWORK_MODE === 2;
    Object.entries(networkDetails).forEach(([chainId, network]) => {
        if (processedChainIds.has(chainId))
            return;
        const isMainnet = network.networkType === "mainnet";
        if ((isMainnet && !shouldProcessMainnet) || (!isMainnet && !shouldProcessTestnet)) {
            return;
        }
        const initialChainlistCount = initialEndpoints.chainlist.get(chainId)?.length || 0;
        const initialEthereumListsCount = initialEndpoints.ethereumLists.get(chainId)?.length || 0;
        const stats = {
            chainId,
            name: network.name,
            healthyRpcCount: 0,
            chainlistRpcCount: 0,
            unhealthyChainlistCount: initialChainlistCount,
            ethereumListsRpcCount: 0,
            unhealthyEthereumListsCount: initialEthereumListsCount,
        };
        if (isMainnet && shouldProcessMainnet) {
            mainnetStats.push(stats);
        }
        else if (!isMainnet && shouldProcessTestnet) {
            testnetStats.push(stats);
        }
    });
}
function shouldCommitChanges(modifiedFiles) {
    if (config_1.default.ENABLE_GIT_SERVICE && modifiedFiles.length > 0) {
        (0, logger_1.info)(`Committing ${modifiedFiles.length} modified files to git repository`);
        return true;
    }
    else if (!config_1.default.ENABLE_GIT_SERVICE) {
        (0, logger_1.info)("Git service is disabled, skipping commit and push");
        return false;
    }
    else {
        (0, logger_1.info)("No files were modified, skipping git operations");
        return false;
    }
}
