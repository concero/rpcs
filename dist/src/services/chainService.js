"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupportedChainIds = getSupportedChainIds;
exports.filterChainlistChains = filterChainlistChains;
exports.filterEthereumListsChains = filterEthereumListsChains;
exports.extractEthereumListsEndpoints = extractEthereumListsEndpoints;
exports.extractChainlistEndpoints = extractChainlistEndpoints;
exports.extractNetworkEndpoints = extractNetworkEndpoints;
exports.sortRpcs = sortRpcs;
exports.getNetworkDetails = getNetworkDetails;
const config_1 = __importDefault(require("../constants/config"));
function getSupportedChainIds(networkDetails) {
    return Object.keys(networkDetails);
}
function filterChainlistChains(rawChainlistRpcs, supportedChainIds) {
    return Object.fromEntries(Object.entries(rawChainlistRpcs).filter(([chainId]) => supportedChainIds.includes(chainId) &&
        !config_1.default.IGNORED_CHAINLIST_CHAIN_IDS.includes(parseInt(chainId, 10))));
}
function filterEthereumListsChains(rawEthereumListsChains, supportedChainIds) {
    return Object.fromEntries(Object.entries(rawEthereumListsChains).filter(([chainId]) => supportedChainIds.includes(chainId) &&
        !config_1.default.IGNORED_ETHEREUM_LISTS_CHAIN_IDS.includes(parseInt(chainId, 10))));
}
function extractEthereumListsEndpoints(ethereumListsChains) {
    return Object.entries(ethereumListsChains).flatMap(([chainId, chain]) => chain.rpc
        .filter(url => url.startsWith("http"))
        .map(url => ({
        chainId,
        url,
        source: "ethereum-lists",
    })));
}
function extractChainlistEndpoints(chainlistRpcs) {
    return Object.entries(chainlistRpcs).flatMap(([chainId, { rpcs }]) => rpcs.map(rpc => ({
        chainId,
        url: rpc,
        source: "chainlist",
    })));
}
function extractNetworkEndpoints(networkDetails) {
    return Object.entries(networkDetails)
        .filter(([_, details]) => details.rpcs && details.rpcs.length > 0)
        .flatMap(([chainId, details]) => details.rpcs
        .filter(url => url && url.startsWith("http"))
        .map(url => ({
        chainId,
        url,
        source: "v2-networks",
    })));
}
function sortRpcs(testedRpcs) {
    const rpcsByChain = new Map();
    testedRpcs.forEach(rpc => {
        if (!rpcsByChain.has(rpc.chainId)) {
            rpcsByChain.set(rpc.chainId, []);
        }
        rpcsByChain.get(rpc.chainId).push(rpc);
    });
    rpcsByChain.forEach(rpcs => rpcs.sort((a, b) => a.responseTime - b.responseTime));
    return rpcsByChain;
}
function getNetworkDetails(chainId, networkDetails) {
    return networkDetails[chainId];
}
