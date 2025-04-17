import fs from "fs";
import path from "path";
import { debug } from "../utils/logger";
import config from "../constants/config";
export function ensureDirectoriesExist(outputDir) {
    var mainnetDir = path.join(outputDir, "mainnet");
    var testnetDir = path.join(outputDir, "testnet");
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, {
            recursive: true
        });
    }
    if (!fs.existsSync(mainnetDir)) {
        fs.mkdirSync(mainnetDir, {
            recursive: true
        });
    }
    if (!fs.existsSync(testnetDir)) {
        fs.mkdirSync(testnetDir, {
            recursive: true
        });
    }
    return {
        mainnetDir: mainnetDir,
        testnetDir: testnetDir
    };
}
export function writeNetworkFile(directory, chainId, rpcs, network) {
    var fileName = "".concat(chainId, "-").concat(network.name, ".json");
    var outputPath = path.join(directory, fileName);
    var urls = rpcs.map(function(rpc) {
        return rpc.url;
    });
    var chainOutput = {
        id: chainId,
        urls: urls,
        chainSelector: network.chainSelector,
        name: network.name
    };
    fs.writeFileSync(outputPath, JSON.stringify(chainOutput, null, 2));
    return outputPath;
}
export function writeChainRpcFiles(rpcsByChain, outputDir, getNetworkForChain) {
    var processMainnet = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : true, processTestnet = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : true;
    var _ensureDirectoriesExist = ensureDirectoriesExist(outputDir), mainnetDir = _ensureDirectoriesExist.mainnetDir, testnetDir = _ensureDirectoriesExist.testnetDir;
    var modifiedFiles = [];
    rpcsByChain.forEach(function(rpcs, chainId) {
        var _getNetworkForChain = getNetworkForChain(chainId), mainnetNetwork = _getNetworkForChain.mainnetNetwork, testnetNetwork = _getNetworkForChain.testnetNetwork;
        // Process mainnet network if it exists and is enabled
        if (mainnetNetwork && processMainnet) {
            var outputPath = writeNetworkFile(mainnetDir, chainId, rpcs, mainnetNetwork);
            modifiedFiles.push(outputPath);
        }
        // Process testnet network if it exists and is enabled
        if (testnetNetwork && processTestnet) {
            var outputPath1 = writeNetworkFile(testnetDir, chainId, rpcs, testnetNetwork);
            modifiedFiles.push(outputPath1);
        }
        if ((!mainnetNetwork || !processMainnet) && (!testnetNetwork || !processTestnet)) {
            debug("No applicable network configuration found for chain ID ".concat(chainId));
        }
    });
    return modifiedFiles;
}
export function generateSupportedChainsFile(networkDetails) {
    var outputPath = path.join(config.OUTPUT_DIR, "supported-chains.json");
    var mainnetObj = {};
    var testnetObj = {};
    Object.values(networkDetails).forEach(function(network) {
        if (network.networkType === "mainnet") {
            mainnetObj[network.chainId.toString()] = network.name;
        } else {
            testnetObj[network.chainId.toString()] = network.name;
        }
    });
    var supportedChains = {
        mainnet: mainnetObj,
        testnet: testnetObj
    };
    fs.writeFileSync(outputPath, JSON.stringify(supportedChains, null, 2));
}
