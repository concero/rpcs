function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
    if (Array.isArray(arr)) return arr;
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
function _sliced_to_array(arr, i) {
    return _array_with_holes(arr) || _iterable_to_array_limit(arr, i) || _unsupported_iterable_to_array(arr, i) || _non_iterable_rest();
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
import fs from "fs";
import path from "path";
import simpleGit from "simple-git";
import config from "./constants/config";
import { mainnetNetworks, testnetNetworks } from "@concero/contract-utils";
import fetchChainlistRpcs from "./fetchers/fetchChainlistRpcs";
import { debug, error, info } from "./logger";
import { testRpcEndpoints } from "./rpcTester";
export default function runService() {
    return _runService.apply(this, arguments);
}
function _runService() {
    _runService = _async_to_generator(function() {
        var conceroNetworks, supportedChainIds, extraRpcs, filteredRpcs, allEndpoints, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, chainId, rpcs, _iteratorNormalCompletion1, _didIteratorError1, _iteratorError1, _iterator1, _step1, rpc, tested, rpcsByChain, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, rpc1, responseTimeMap, modifiedFiles, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _loop, _iterator3, _step3, git, err;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _state.trys.push([
                        0,
                        6,
                        ,
                        7
                    ]);
                    info("Starting RPC service...");
                    // Determine which networks to use based on config
                    conceroNetworks = config.USE_MAINNET ? mainnetNetworks : testnetNetworks;
                    // Get chainIds from conceroNetworks
                    supportedChainIds = Object.values(conceroNetworks).map(function(network) {
                        return network.chainId.toString();
                    });
                    info("Using ".concat(config.USE_MAINNET ? "mainnet" : "testnet", " networks. Supported chain IDs: ").concat(supportedChainIds.join(", ")));
                    return [
                        4,
                        fetchChainlistRpcs()
                    ];
                case 1:
                    extraRpcs = _state.sent();
                    // Filter by supported chain IDs and exclude ignored chains
                    filteredRpcs = Object.fromEntries(Object.entries(extraRpcs).filter(function(param) {
                        var _param = _sliced_to_array(param, 1), chainId = _param[0];
                        return supportedChainIds.includes(chainId) && !config.IGNORE_CHAIN_IDS.includes(parseInt(chainId, 10));
                    }));
                    debug("Found ".concat(Object.keys(filteredRpcs).length, " chains to process out of ").concat(Object.keys(extraRpcs).length, " total chains"));
                    allEndpoints = [];
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    try {
                        for(_iterator = Object.keys(filteredRpcs)[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                            chainId = _step.value;
                            rpcs = filteredRpcs[chainId].rpcs;
                            _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
                            try {
                                for(_iterator1 = rpcs[Symbol.iterator](); !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                                    rpc = _step1.value;
                                    allEndpoints.push({
                                        chainId: chainId,
                                        url: rpc
                                    });
                                }
                            } catch (err) {
                                _didIteratorError1 = true;
                                _iteratorError1 = err;
                            } finally{
                                try {
                                    if (!_iteratorNormalCompletion1 && _iterator1.return != null) {
                                        _iterator1.return();
                                    }
                                } finally{
                                    if (_didIteratorError1) {
                                        throw _iteratorError1;
                                    }
                                }
                            }
                        }
                    } catch (err) {
                        _didIteratorError = true;
                        _iteratorError = err;
                    } finally{
                        try {
                            if (!_iteratorNormalCompletion && _iterator.return != null) {
                                _iterator.return();
                            }
                        } finally{
                            if (_didIteratorError) {
                                throw _iteratorError;
                            }
                        }
                    }
                    return [
                        4,
                        testRpcEndpoints(allEndpoints)
                    ];
                case 2:
                    tested = _state.sent();
                    if (!fs.existsSync(config.OUTPUT_DIR)) {
                        fs.mkdirSync(config.OUTPUT_DIR, {
                            recursive: true
                        });
                    }
                    rpcsByChain = new Map();
                    _iteratorNormalCompletion2 = true, _didIteratorError2 = false, _iteratorError2 = undefined;
                    try {
                        for(_iterator2 = tested[Symbol.iterator](); !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true){
                            rpc1 = _step2.value;
                            if (!rpcsByChain.has(rpc1.chainId)) {
                                rpcsByChain.set(rpc1.chainId, []);
                            }
                            rpcsByChain.get(rpc1.chainId).push(rpc1);
                        }
                    } catch (err) {
                        _didIteratorError2 = true;
                        _iteratorError2 = err;
                    } finally{
                        try {
                            if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                                _iterator2.return();
                            }
                        } finally{
                            if (_didIteratorError2) {
                                throw _iteratorError2;
                            }
                        }
                    }
                    responseTimeMap = new Map();
                    modifiedFiles = [];
                    _iteratorNormalCompletion3 = true, _didIteratorError3 = false, _iteratorError3 = undefined;
                    try {
                        _loop = function() {
                            var _step_value = _sliced_to_array(_step3.value, 2), chainId = _step_value[0], rpcs = _step_value[1];
                            var outputPath = path.join(config.OUTPUT_DIR, "".concat(chainId, ".json"));
                            rpcs.sort(function(a, b) {
                                return a.responseTime - b.responseTime;
                            });
                            rpcs.forEach(function(rpc) {
                                responseTimeMap.set(rpc.url, rpc.responseTime);
                            });
                            // Find the network in conceroNetworks
                            var network = Object.values(conceroNetworks).find(function(network) {
                                return network.chainId.toString() === chainId;
                            });
                            if (!network) {
                                debug("No network configuration found for chain ID ".concat(chainId));
                                return "continue";
                            }
                            var chainOutput = {
                                id: chainId,
                                urls: rpcs.map(function(rpc) {
                                    return rpc.url.replace("https://", "");
                                }),
                                chainSelector: network.chainSelector,
                                name: network.name
                            };
                            fs.writeFileSync(outputPath, JSON.stringify(chainOutput, null, 2));
                            modifiedFiles.push(outputPath);
                        };
                        for(_iterator3 = rpcsByChain.entries()[Symbol.iterator](); !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true)_loop();
                    } catch (err) {
                        _didIteratorError3 = true;
                        _iteratorError3 = err;
                    } finally{
                        try {
                            if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
                                _iterator3.return();
                            }
                        } finally{
                            if (_didIteratorError3) {
                                throw _iteratorError3;
                            }
                        }
                    }
                    // Git operations
                    git = simpleGit(config.GIT_REPO_PATH);
                    return [
                        4,
                        git.add(modifiedFiles)
                    ];
                case 3:
                    _state.sent();
                    return [
                        4,
                        git.commit("Update chain RPC files ".concat(new Date().toISOString()))
                    ];
                case 4:
                    _state.sent();
                    return [
                        4,
                        git.push()
                    ];
                case 5:
                    _state.sent();
                    info("Service run complete");
                    return [
                        2,
                        rpcsByChain
                    ];
                case 6:
                    err = _state.sent();
                    error("Service run error: ".concat(String(err)));
                    throw err;
                case 7:
                    return [
                        2
                    ];
            }
        });
    });
    return _runService.apply(this, arguments);
}
