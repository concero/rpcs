"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchNetworksData = fetchNetworksData;
exports.fetchNetworkDetails = fetchNetworkDetails;
exports.fetchAllNetworkDetails = fetchAllNetworkDetails;
const logger_1 = require("../utils/logger");
const config_1 = __importDefault(require("../constants/config"));
async function fetchNetworksData(isMainnet) {
    const networkType = isMainnet ? "mainnet" : "testnet";
    const url = config_1.default.CONCERO_NETWORKS_DATA_URL_TEMPLATE.replace("${CONCERO_NETWORKS_GITHUB_BASE_URL}", config_1.default.CONCERO_NETWORKS_GITHUB_BASE_URL).replace("${networkType}", networkType);
    try {
        // info(`Fetching ${networkType} networks from GitHub...`);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${networkType} networks: ${response.status}`);
        }
        const data = await response.json();
        (0, logger_1.info)(`Fetched ${Object.keys(data).length} ${networkType} networks from Concero`);
        return data;
    }
    catch (err) {
        (0, logger_1.error)(`Error fetching ${networkType} networks: ${err}`);
        throw err;
    }
}
async function fetchNetworkDetails(networkName, isMainnet) {
    const networkType = isMainnet ? "mainnet" : "testnet";
    const url = config_1.default.CONCERO_NETWORK_DETAILS_URL_TEMPLATE.replace("${CONCERO_NETWORKS_GITHUB_BASE_URL}", config_1.default.CONCERO_NETWORKS_GITHUB_BASE_URL)
        .replace("${networkType}", networkType)
        .replace("${networkName}", networkName);
    try {
        (0, logger_1.debug)(`Fetching details for ${networkName} (${networkType})... from Concero`);
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status !== 404) {
                (0, logger_1.debug)(`Failed to fetch network details for ${networkName}: ${response.status}`);
            }
            return null;
        }
        const data = (await response.json());
        return {
            ...data,
            networkType: networkType,
        };
    }
    catch (err) {
        (0, logger_1.debug)(`Error fetching network details for ${networkName}: ${err}`);
        return null;
    }
}
async function fetchAllNetworkDetails() {
    const result = {};
    async function processNetworks(isMainnet) {
        const networks = await fetchNetworksData(isMainnet);
        const networkType = isMainnet ? "mainnet" : "testnet";
        // info(`Fetching details for ${Object.keys(networks).length} ${networkType} networks...`);
        const fetchPromises = Object.entries(networks).map(async ([networkName, network]) => {
            const details = await fetchNetworkDetails(networkName, isMainnet);
            if (details) {
                result[network.chainId.toString()] = details;
            }
        });
        await Promise.all(fetchPromises);
    }
    if (config_1.default.NETWORK_MODE === 1 || config_1.default.NETWORK_MODE === 2) {
        await processNetworks(true);
    }
    if (config_1.default.NETWORK_MODE === 0 || config_1.default.NETWORK_MODE === 2) {
        await processNetworks(false);
    }
    (0, logger_1.info)(`Fetched details for ${Object.keys(result).length} networks from Concero`);
    return result;
}
