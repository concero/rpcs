"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testnetChains = exports.mainnetChains = void 0;
var fs = require("fs");
var path = require("path");
function loadChainData() {
    var mainnetPath = path.join(__dirname, "output/mainnet.json");
    var testnetPath = path.join(__dirname, "output/testnet.json");
    var mainnetChains = {};
    var testnetChains = {};
    if (fs.existsSync(mainnetPath)) {
        var mainnetData = JSON.parse(fs.readFileSync(mainnetPath, "utf-8"));
        Object.entries(mainnetData).forEach(function (_a) {
            var chainId = _a[0], data = _a[1];
            var chainData = data;
            var fullChainData = {
                id: chainId,
                urls: chainData.urls,
                chainSelector: chainData.chainSelector,
                name: chainData.name,
            };
            mainnetChains[chainId] = fullChainData;
        });
    }
    if (fs.existsSync(testnetPath)) {
        var testnetData = JSON.parse(fs.readFileSync(testnetPath, "utf-8"));
        Object.entries(testnetData).forEach(function (_a) {
            var chainId = _a[0], data = _a[1];
            var chainData = data;
            var fullChainData = {
                id: chainId,
                urls: chainData.urls,
                chainSelector: chainData.chainSelector,
                name: chainData.name,
            };
            testnetChains[chainId] = fullChainData;
        });
    }
    return {
        mainnet: mainnetChains,
        testnet: testnetChains,
    };
}
var chainData = loadChainData();
exports.mainnetChains = chainData.mainnet;
exports.testnetChains = chainData.testnet;
