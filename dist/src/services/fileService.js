"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDirectoriesExist = ensureDirectoriesExist;
exports.writeNetworkFile = writeNetworkFile;
exports.writeChainRpcFiles = writeChainRpcFiles;
exports.generateSupportedChainsFile = generateSupportedChainsFile;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../utils/logger");
const config_1 = __importDefault(require("../constants/config"));
function ensureDirectoriesExist(outputDir) {
    const mainnetDir = path_1.default.join(outputDir, "mainnet");
    const testnetDir = path_1.default.join(outputDir, "testnet");
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    if (!fs_1.default.existsSync(mainnetDir)) {
        fs_1.default.mkdirSync(mainnetDir, { recursive: true });
    }
    if (!fs_1.default.existsSync(testnetDir)) {
        fs_1.default.mkdirSync(testnetDir, { recursive: true });
    }
    return { mainnetDir, testnetDir };
}
function writeNetworkFile(directory, chainId, rpcs, network) {
    const fileName = `${chainId}-${network.name}.json`;
    const outputPath = path_1.default.join(directory, fileName);
    const urls = rpcs.map(rpc => rpc.url);
    const chainOutput = {
        id: chainId,
        urls: urls,
        chainSelector: network.chainSelector,
        name: network.name,
    };
    fs_1.default.writeFileSync(outputPath, JSON.stringify(chainOutput, null, 2));
    return outputPath;
}
function writeChainRpcFiles(rpcsByChain, outputDir, getNetworkForChain, processMainnet = true, processTestnet = true) {
    const { mainnetDir, testnetDir } = ensureDirectoriesExist(outputDir);
    const modifiedFiles = [];
    rpcsByChain.forEach((rpcs, chainId) => {
        const { mainnetNetwork, testnetNetwork } = getNetworkForChain(chainId);
        // Process mainnet network if it exists and is enabled
        if (mainnetNetwork && processMainnet) {
            const outputPath = writeNetworkFile(mainnetDir, chainId, rpcs, mainnetNetwork);
            modifiedFiles.push(outputPath);
        }
        // Process testnet network if it exists and is enabled
        if (testnetNetwork && processTestnet) {
            const outputPath = writeNetworkFile(testnetDir, chainId, rpcs, testnetNetwork);
            modifiedFiles.push(outputPath);
        }
        if ((!mainnetNetwork || !processMainnet) && (!testnetNetwork || !processTestnet)) {
            (0, logger_1.debug)(`No applicable network configuration found for chain ID ${chainId}`);
        }
    });
    return modifiedFiles;
}
function generateSupportedChainsFile(networkDetails) {
    const outputPath = path_1.default.join(config_1.default.OUTPUT_DIR, "supported-chains.json");
    const mainnetObj = {};
    const testnetObj = {};
    Object.values(networkDetails).forEach(network => {
        if (network.networkType === "mainnet") {
            mainnetObj[network.chainId.toString()] = network.name;
        }
        else {
            testnetObj[network.chainId.toString()] = network.name;
        }
    });
    const supportedChains = {
        mainnet: mainnetObj,
        testnet: testnetObj,
    };
    fs_1.default.writeFileSync(outputPath, JSON.stringify(supportedChains, null, 2));
}
