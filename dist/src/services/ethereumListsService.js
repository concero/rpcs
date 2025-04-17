"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchChainFromEthereumLists = fetchChainFromEthereumLists;
exports.fetchEthereumListsChains = fetchEthereumListsChains;
const config_1 = __importDefault(require("../constants/config"));
const logger_1 = require("../utils/logger");
async function fetchChainFromEthereumLists(chainId) {
    try {
        const url = config_1.default.ETHEREUM_LISTS_URL_TEMPLATE.replace("{chainId}", chainId);
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status !== 404) {
                (0, logger_1.debug)(`Failed to fetch chain ${chainId} from ethereum-lists: ${response.status}`);
            }
            return null;
        }
        const chainData = await response.json();
        return chainData;
    }
    catch (err) {
        (0, logger_1.debug)(`Error fetching chain ${chainId} from ethereum-lists: ${err}`);
        return null;
    }
}
async function fetchEthereumListsChains(chainIds) {
    const result = {};
    // info(`Fetching ${chainIds.length} chains from ethereum-lists...`);
    const fetchPromises = chainIds
        .filter(id => !config_1.default.IGNORED_ETHEREUM_LISTS_CHAIN_IDS.includes(parseInt(id, 10)))
        .map(async (chainId) => {
        const chain = await fetchChainFromEthereumLists(chainId);
        if (chain) {
            result[chainId] = chain;
        }
    });
    await Promise.all(fetchPromises);
    (0, logger_1.info)(`Fetched ${Object.keys(result).length} chains from ethereum-lists`);
    return result;
}
