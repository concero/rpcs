function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes(arr) {
    if (Array.isArray(arr)) return _array_like_to_array(arr);
}
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) {
        resolve(value);
    } else {
        Promise.resolve(value).then(_next, _throw);
    }
}
function _async_to_generator(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _iterable_to_array(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter);
}
function _iterable_to_array_limit(arr, i) {
    var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];
    if (_i == null) return;
    var _arr = [];
    var _n = true;
    var _d = false;
    var _s, _e;
    try {
        for(_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true){
            _arr.push(_s.value);
            if (i && _arr.length === i) break;
        }
    } catch (err) {
        _d = true;
        _e = err;
    } finally{
        try {
            if (!_n && _i["return"] != null) _i["return"]();
        } finally{
            if (_d) throw _e;
        }
    }
    return _arr;
}
function _non_iterable_rest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _non_iterable_spread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array(arr, i) {
    return _array_with_holes(arr) || _iterable_to_array_limit(arr, i) || _unsupported_iterable_to_array(arr, i) || _non_iterable_rest();
}
function _to_consumable_array(arr) {
    return _array_without_holes(arr) || _iterable_to_array(arr) || _unsupported_iterable_to_array(arr) || _non_iterable_spread();
}
function _unsupported_iterable_to_array(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array(o, minLen);
}
function _ts_generator(thisArg, body) {
    var f, y, t, g, _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    };
    return g = {
        next: verb(0),
        "throw": verb(1),
        "return": verb(2)
    }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
    }), g;
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(_)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
}
import config from "../constants/config";
import { fetchChainlistRpcs, parseChainlistRpcs } from "./chainlistService";
import { fetchEthereumListsChains } from "./ethereumListsService";
import { debug, error, info } from "../utils/logger";
import { testRpcEndpoints } from "./rpcTester";
import { extractChainlistEndpoints, extractEthereumListsEndpoints, extractNetworkEndpoints, filterChainlistChains, filterEthereumListsChains, getNetworkDetails, getSupportedChainIds } from "./chainService";
import { generateSupportedChainsFile, writeChainRpcFiles } from "./fileService";
import { commitAndPushChanges } from "./gitService";
import { displayNetworkStats } from "../utils/displayNetworkStats";
import { sanitizeUrl } from "../utils/sanitizeUrl";
import { fetchAllNetworkDetails } from "./networkService";
export function runRpcService() {
    return _runRpcService.apply(this, arguments);
}
function _runRpcService() {
    _runRpcService = _async_to_generator(function() {
        var networkDetails, supportedChainIds, rawChainlistRpcs, parsedChainlistRpcs, filteredChainlistRpcs, ethereumListsChains, filteredEthereumListsChains, chainlistEndpoints, ethereumListsEndpoints, networkEndpoints, initialEndpoints, urlMap, allEndpointsArray, dedupedEndpoints, testResult, testedEndpoints, rpcsByReturnedChainId, mainnetStats, testnetStats, shouldProcessMainnet, shouldProcessTestnet, filteredSortedRpcs, modifiedFiles, processedChainIds, err;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _state.trys.push([
                        0,
                        8,
                        ,
                        9
                    ]);
                    info("Starting RPC service...");
                    return [
                        4,
                        fetchAllNetworkDetails()
                    ];
                case 1:
                    networkDetails = _state.sent();
                    // Get supported chain IDs from fetched network details
                    supportedChainIds = getSupportedChainIds(networkDetails);
                    info("Supported chain IDs: ".concat(supportedChainIds.join(", ")));
                    return [
                        4,
                        fetchChainlistRpcs()
                    ];
                case 2:
                    rawChainlistRpcs = _state.sent();
                    parsedChainlistRpcs = parseChainlistRpcs(rawChainlistRpcs);
                    filteredChainlistRpcs = filterChainlistChains(parsedChainlistRpcs, supportedChainIds);
                    return [
                        4,
                        fetchEthereumListsChains(supportedChainIds)
                    ];
                case 3:
                    ethereumListsChains = _state.sent();
                    filteredEthereumListsChains = filterEthereumListsChains(ethereumListsChains, supportedChainIds);
                    debug("Found ".concat(Object.keys(filteredChainlistRpcs).length, " chains from chainlist and ").concat(Object.keys(filteredEthereumListsChains).length, " chains from ethereum-lists to process"));
                    // Extract endpoints from all sources
                    chainlistEndpoints = extractChainlistEndpoints(filteredChainlistRpcs);
                    ethereumListsEndpoints = extractEthereumListsEndpoints(filteredEthereumListsChains);
                    networkEndpoints = extractNetworkEndpoints(networkDetails);
                    // Track initial endpoint counts by chain ID and source
                    initialEndpoints = {
                        chainlist: new Map(),
                        ethereumLists: new Map(),
                        v2Networks: new Map()
                    };
                    // Group by chain ID for later statistics
                    chainlistEndpoints.forEach(function(endpoint) {
                        if (!initialEndpoints.chainlist.has(endpoint.chainId)) {
                            initialEndpoints.chainlist.set(endpoint.chainId, []);
                        }
                        initialEndpoints.chainlist.get(endpoint.chainId).push(endpoint);
                    });
                    ethereumListsEndpoints.forEach(function(endpoint) {
                        if (!initialEndpoints.ethereumLists.has(endpoint.chainId)) {
                            initialEndpoints.ethereumLists.set(endpoint.chainId, []);
                        }
                        initialEndpoints.ethereumLists.get(endpoint.chainId).push(endpoint);
                    });
                    networkEndpoints.forEach(function(endpoint) {
                        if (!initialEndpoints.v2Networks.has(endpoint.chainId)) {
                            initialEndpoints.v2Networks.set(endpoint.chainId, []);
                        }
                        initialEndpoints.v2Networks.get(endpoint.chainId).push(endpoint);
                    });
                    urlMap = new Map();
                    allEndpointsArray = _to_consumable_array(chainlistEndpoints).concat(_to_consumable_array(ethereumListsEndpoints), _to_consumable_array(networkEndpoints));
                    allEndpointsArray.forEach(function(endpoint) {
                        var _urlMap_get;
                        var sanitizedUrl = sanitizeUrl(endpoint.url);
                        endpoint.url = sanitizedUrl;
                        // Prioritize v2-networks over chainlist over ethereum-lists
                        if (!urlMap.has(sanitizedUrl) || endpoint.source === "chainlist" && ((_urlMap_get = urlMap.get(sanitizedUrl)) === null || _urlMap_get === void 0 ? void 0 : _urlMap_get.source) === "ethereum-lists" || endpoint.source === "v2-networks") {
                            urlMap.set(sanitizedUrl, endpoint);
                        }
                    });
                    dedupedEndpoints = Array.from(urlMap.values());
                    info("Testing ".concat(dedupedEndpoints.length, " unique endpoints (").concat(chainlistEndpoints.length, " from chainlist, ").concat(ethereumListsEndpoints.length, " from ethereum-lists, ").concat(networkEndpoints.length, " from v2-networks, ").concat(allEndpointsArray.length - dedupedEndpoints.length, " duplicates removed)"));
                    return [
                        4,
                        testRpcEndpoints(dedupedEndpoints)
                    ];
                case 4:
                    testResult = _state.sent();
                    testedEndpoints = testResult.healthyRpcs;
                    if (testResult.chainIdMismatches.size > 0) {
                        info("=== Chain ID Mismatches ===");
                        testResult.chainIdMismatches.forEach(function(returnedIds, expectedId) {
                            info("Chain ID ".concat(expectedId, " had mismatches: ").concat(returnedIds.join(", ")));
                        });
                    }
                    rpcsByReturnedChainId = new Map();
                    testedEndpoints.forEach(function(rpc) {
                        if (!rpcsByReturnedChainId.has(rpc.returnedChainId)) {
                            rpcsByReturnedChainId.set(rpc.returnedChainId, []);
                        }
                        rpcsByReturnedChainId.get(rpc.returnedChainId).push(rpc);
                    });
                    rpcsByReturnedChainId.forEach(function(rpcs) {
                        return rpcs.sort(function(a, b) {
                            return a.responseTime - b.responseTime;
                        });
                    });
                    mainnetStats = [];
                    testnetStats = [];
                    shouldProcessMainnet = config.NETWORK_MODE === 1 || config.NETWORK_MODE === 2;
                    shouldProcessTestnet = config.NETWORK_MODE === 0 || config.NETWORK_MODE === 2;
                    filteredSortedRpcs = new Map(Array.from(rpcsByReturnedChainId.entries()).filter(function(param) {
                        var _param = _sliced_to_array(param, 1), chainId = _param[0];
                        var network = getNetworkDetails(chainId, networkDetails);
                        if (!network) return false;
                        var isMainnet = network.name.indexOf("testnet") === -1 && network.name.indexOf("sepolia") === -1 && network.name.indexOf("goerli") === -1;
                        if (isMainnet && shouldProcessMainnet) return true;
                        if (!isMainnet && shouldProcessTestnet) return true;
                        return false;
                    }));
                    modifiedFiles = writeChainRpcFiles(filteredSortedRpcs, config.OUTPUT_DIR, function(chainId) {
                        var network = getNetworkDetails(chainId, networkDetails);
                        if (!network) return {};
                        return {
                            mainnetNetwork: network.networkType === "mainnet" ? network : undefined,
                            testnetNetwork: network.networkType === "testnet" ? network : undefined
                        };
                    }, shouldProcessMainnet, shouldProcessTestnet);
                    generateSupportedChainsFile(networkDetails);
                    processedChainIds = new Set();
                    filteredSortedRpcs.forEach(function(rpcs, chainId) {
                        var _initialEndpoints_chainlist_get, _initialEndpoints_ethereumLists_get, _initialEndpoints_v2Networks_get;
                        var network = getNetworkDetails(chainId, networkDetails);
                        if (!network) return;
                        processedChainIds.add(chainId);
                        var isMainnet = network.networkType === "mainnet";
                        var chainlistRpcs = rpcs.filter(function(rpc) {
                            return rpc.source === "chainlist";
                        });
                        var ethereumListsRpcs = rpcs.filter(function(rpc) {
                            return rpc.source === "ethereum-lists";
                        });
                        var v2NetworksRpcs = rpcs.filter(function(rpc) {
                            return rpc.source === "v2-networks";
                        });
                        var uniqueChainlistUrls = new Set(chainlistRpcs.map(function(rpc) {
                            return rpc.url;
                        })).size;
                        var uniqueEthereumListsUrls = new Set(ethereumListsRpcs.map(function(rpc) {
                            return rpc.url;
                        })).size;
                        var uniqueV2NetworksUrls = new Set(v2NetworksRpcs.map(function(rpc) {
                            return rpc.url;
                        })).size;
                        var initialChainlistCount = ((_initialEndpoints_chainlist_get = initialEndpoints.chainlist.get(chainId)) === null || _initialEndpoints_chainlist_get === void 0 ? void 0 : _initialEndpoints_chainlist_get.length) || 0;
                        var initialEthereumListsCount = ((_initialEndpoints_ethereumLists_get = initialEndpoints.ethereumLists.get(chainId)) === null || _initialEndpoints_ethereumLists_get === void 0 ? void 0 : _initialEndpoints_ethereumLists_get.length) || 0;
                        var initialV2NetworksCount = ((_initialEndpoints_v2Networks_get = initialEndpoints.v2Networks.get(chainId)) === null || _initialEndpoints_v2Networks_get === void 0 ? void 0 : _initialEndpoints_v2Networks_get.length) || 0;
                        var unhealthyChainlistCount = initialChainlistCount - chainlistRpcs.length;
                        var unhealthyEthereumListsCount = initialEthereumListsCount - ethereumListsRpcs.length;
                        var unhealthyV2NetworksCount = initialV2NetworksCount - v2NetworksRpcs.length;
                        var stats = {
                            chainId: chainId,
                            name: network.name,
                            chainSelector: network.chainSelector,
                            healthyRpcCount: rpcs.length,
                            chainlistRpcCount: chainlistRpcs.length,
                            uniqueChainlistRpcCount: uniqueChainlistUrls,
                            ethereumListsRpcCount: ethereumListsRpcs.length,
                            uniqueEthereumListsRpcCount: uniqueEthereumListsUrls,
                            v2NetworksRpcCount: v2NetworksRpcs.length,
                            uniqueV2NetworksRpcCount: uniqueV2NetworksUrls,
                            unhealthyChainlistCount: unhealthyChainlistCount,
                            unhealthyEthereumListsCount: unhealthyEthereumListsCount,
                            unhealthyV2NetworksCount: unhealthyV2NetworksCount,
                            initialChainlistCount: initialChainlistCount,
                            initialEthereumListsCount: initialEthereumListsCount,
                            initialV2NetworksCount: initialV2NetworksCount
                        };
                        if (isMainnet && shouldProcessMainnet) {
                            mainnetStats.push(stats);
                        } else if (!isMainnet && shouldProcessTestnet) {
                            testnetStats.push(stats);
                        }
                    });
                    // Then add statistics for networks with no healthy RPCs
                    Object.entries(networkDetails).forEach(function(param) {
                        var _param = _sliced_to_array(param, 2), chainId = _param[0], network = _param[1];
                        var _initialEndpoints_chainlist_get, _initialEndpoints_ethereumLists_get, _initialEndpoints_v2Networks_get;
                        if (processedChainIds.has(chainId)) return; // Skip already processed networks
                        var isMainnet = network.networkType === "mainnet";
                        // Skip networks that shouldn't be processed based on mode
                        if (isMainnet && !shouldProcessMainnet || !isMainnet && !shouldProcessTestnet) {
                            return;
                        }
                        var initialChainlistCount = ((_initialEndpoints_chainlist_get = initialEndpoints.chainlist.get(chainId)) === null || _initialEndpoints_chainlist_get === void 0 ? void 0 : _initialEndpoints_chainlist_get.length) || 0;
                        var initialEthereumListsCount = ((_initialEndpoints_ethereumLists_get = initialEndpoints.ethereumLists.get(chainId)) === null || _initialEndpoints_ethereumLists_get === void 0 ? void 0 : _initialEndpoints_ethereumLists_get.length) || 0;
                        var initialV2NetworksCount = ((_initialEndpoints_v2Networks_get = initialEndpoints.v2Networks.get(chainId)) === null || _initialEndpoints_v2Networks_get === void 0 ? void 0 : _initialEndpoints_v2Networks_get.length) || 0;
                        var stats = {
                            chainId: chainId,
                            name: network.name,
                            chainSelector: network.chainSelector,
                            healthyRpcCount: 0,
                            chainlistRpcCount: 0,
                            uniqueChainlistRpcCount: 0,
                            ethereumListsRpcCount: 0,
                            uniqueEthereumListsRpcCount: 0,
                            v2NetworksRpcCount: 0,
                            uniqueV2NetworksRpcCount: 0,
                            unhealthyChainlistCount: initialChainlistCount,
                            unhealthyEthereumListsCount: initialEthereumListsCount,
                            unhealthyV2NetworksCount: initialV2NetworksCount,
                            initialChainlistCount: initialChainlistCount,
                            initialEthereumListsCount: initialEthereumListsCount,
                            initialV2NetworksCount: initialV2NetworksCount
                        };
                        if (isMainnet && shouldProcessMainnet) {
                            mainnetStats.push(stats);
                        } else if (!isMainnet && shouldProcessTestnet) {
                            testnetStats.push(stats);
                        }
                    });
                    // Display statistics
                    displayNetworkStats(mainnetStats, testnetStats);
                    if (!(config.ENABLE_GIT_SERVICE && modifiedFiles.length > 0)) return [
                        3,
                        6
                    ];
                    info("Committing ".concat(modifiedFiles.length, " modified files to git repository"));
                    return [
                        4,
                        commitAndPushChanges(config.GIT_REPO_PATH, modifiedFiles)
                    ];
                case 5:
                    _state.sent();
                    return [
                        3,
                        7
                    ];
                case 6:
                    if (!config.ENABLE_GIT_SERVICE) {
                        info("Git service is disabled, skipping commit and push");
                    } else {
                        info("No files were modified, skipping git operations");
                    }
                    _state.label = 7;
                case 7:
                    info("Service run complete");
                    return [
                        2,
                        filteredSortedRpcs
                    ];
                case 8:
                    err = _state.sent();
                    error("Service run error: ".concat(String(err)));
                    throw err;
                case 9:
                    return [
                        2
                    ];
            }
        });
    });
    return _runRpcService.apply(this, arguments);
}
