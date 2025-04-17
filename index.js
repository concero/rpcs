"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allChains = exports.testnetChains = exports.mainnetChains = exports.supportedChains = void 0;
var fs = require("fs");
var path = require("path");
var supportedChainsPath = path.join(__dirname, "output/supported-chains.json");
exports.supportedChains = JSON.parse(fs.readFileSync(supportedChainsPath, "utf-8"));
function loadChainData() {
    var mainnetChains = {};
    var testnetChains = {};
    var allChains = {};
    Object.entries(exports.supportedChains.mainnet).forEach(function (_a) {
        var chainId = _a[0], name = _a[1];
        var filePath = path.join(__dirname, "output/mainnet/".concat(chainId, "-").concat(name, ".json"));
        if (fs.existsSync(filePath)) {
            var chainData_1 = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            mainnetChains[chainId] = chainData_1;
            allChains[chainId] = chainData_1;
        }
    });
    Object.entries(exports.supportedChains.testnet).forEach(function (_a) {
        var chainId = _a[0], name = _a[1];
        var filePath = path.join(__dirname, "output/testnet/".concat(chainId, "-").concat(name, ".json"));
        if (fs.existsSync(filePath)) {
            var chainData_2 = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            testnetChains[chainId] = chainData_2;
            allChains[chainId] = chainData_2;
        }
    });
    return {
        mainnet: mainnetChains,
        testnet: testnetChains,
        all: allChains,
    };
}
var chainData = loadChainData();
exports.mainnetChains = chainData.mainnet;
exports.testnetChains = chainData.testnet;
exports.allChains = chainData.all;
