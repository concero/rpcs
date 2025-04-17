"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.allChains = exports.testnetChains = exports.mainnetChains = exports.supportedChains = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const supportedChainsPath = path_1.default.join(__dirname, "output/supported-chains.json");
exports.supportedChains = JSON.parse(fs_1.default.readFileSync(supportedChainsPath, "utf-8"));
function loadChainData() {
    const mainnetChains = {};
    const testnetChains = {};
    const allChains = {};
    Object.entries(exports.supportedChains.mainnet).forEach(([chainId, name]) => {
        const filePath = path_1.default.join(__dirname, `output/mainnet/${chainId}-${name}.json`);
        if (fs_1.default.existsSync(filePath)) {
            const chainData = JSON.parse(fs_1.default.readFileSync(filePath, "utf-8"));
            mainnetChains[chainId] = chainData;
            allChains[chainId] = chainData;
        }
    });
    Object.entries(exports.supportedChains.testnet).forEach(([chainId, name]) => {
        const filePath = path_1.default.join(__dirname, `output/testnet/${chainId}-${name}.json`);
        if (fs_1.default.existsSync(filePath)) {
            const chainData = JSON.parse(fs_1.default.readFileSync(filePath, "utf-8"));
            testnetChains[chainId] = chainData;
            allChains[chainId] = chainData;
        }
    });
    return {
        mainnet: mainnetChains,
        testnet: testnetChains,
        all: allChains,
    };
}
const chainData = loadChainData();
exports.mainnetChains = chainData.mainnet;
exports.testnetChains = chainData.testnet;
exports.allChains = chainData.all;
