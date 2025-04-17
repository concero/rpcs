function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
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
function _non_iterable_spread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array(arr) {
    return _array_without_holes(arr) || _iterable_to_array(arr) || _unsupported_iterable_to_array(arr) || _non_iterable_spread();
}
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
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
function _ts_values(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function() {
            if (o && i >= o.length) o = void 0;
            return {
                value: o && o[i++],
                done: !o
            };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
import http from "http";
import https from "https";
import config from "../constants/config";
import { debug, warn } from "../utils/logger";
var httpAgent = new http.Agent({
    keepAlive: true
});
var httpsAgent = new https.Agent({
    keepAlive: true
});
function delay(ms) {
    return _delay.apply(this, arguments);
}
function _delay() {
    _delay = _async_to_generator(function(ms) {
        return _ts_generator(this, function(_state) {
            return [
                2,
                new Promise(function(resolve) {
                    return setTimeout(resolve, ms);
                })
            ];
        });
    });
    return _delay.apply(this, arguments);
}
function testOneRpc(endpoint) {
    return _testOneRpc.apply(this, arguments);
}
function _testOneRpc() {
    _testOneRpc = _async_to_generator(function(endpoint) {
        var _loop, attempt, maxRetries, _ret;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _loop = function() {
                        var start, controller, timeoutId, options, chainIdResponse, chainIdJson, returnedChainId, err, errorMessage, statusCode;
                        return _ts_generator(this, function(_state) {
                            switch(_state.label){
                                case 0:
                                    start = Date.now();
                                    controller = new AbortController();
                                    timeoutId = setTimeout(function() {
                                        return controller.abort();
                                    }, config.RPC_REQUEST_TIMEOUT_MS);
                                    _state.label = 1;
                                case 1:
                                    _state.trys.push([
                                        1,
                                        7,
                                        ,
                                        10
                                    ]);
                                    options = {
                                        method: "POST",
                                        headers: {
                                            "Content-Type": "application/json"
                                        },
                                        body: JSON.stringify({
                                            jsonrpc: "2.0",
                                            method: "eth_chainId",
                                            params: [],
                                            id: 1
                                        }),
                                        signal: controller.signal
                                    };
                                    options.agent = endpoint.url.startsWith("https") ? httpsAgent : httpAgent;
                                    return [
                                        4,
                                        fetch(endpoint.url, options)
                                    ];
                                case 2:
                                    chainIdResponse = _state.sent();
                                    clearTimeout(timeoutId);
                                    if (!(chainIdResponse.status === 429)) return [
                                        3,
                                        5
                                    ];
                                    debug("Rate limited (status 429) for endpoint: ".concat(endpoint.url));
                                    if (!(attempt < maxRetries)) return [
                                        3,
                                        4
                                    ];
                                    return [
                                        4,
                                        delay(config.RPC_CHECKER_RETRY_DELAY_MS)
                                    ];
                                case 3:
                                    _state.sent();
                                    attempt++;
                                    return [
                                        2,
                                        "continue"
                                    ];
                                case 4:
                                    return [
                                        2,
                                        {
                                            v: null
                                        }
                                    ];
                                case 5:
                                    if (!chainIdResponse.ok) {
                                        debug("Error response for endpoint: ".concat(endpoint.url, ", status: ").concat(chainIdResponse.status, ", statusText: ").concat(chainIdResponse.statusText));
                                        return [
                                            2,
                                            {
                                                v: null
                                            }
                                        ];
                                    }
                                    return [
                                        4,
                                        chainIdResponse.json()
                                    ];
                                case 6:
                                    chainIdJson = _state.sent();
                                    if (!(chainIdJson === null || chainIdJson === void 0 ? void 0 : chainIdJson.result) || !/^0x[0-9A-Fa-f]+$/.test(chainIdJson.result)) {
                                        debug("Invalid chainId result from endpoint: ".concat(endpoint.url));
                                        return [
                                            2,
                                            {
                                                v: null
                                            }
                                        ];
                                    }
                                    returnedChainId = parseInt(chainIdJson.result, 16).toString();
                                    return [
                                        2,
                                        {
                                            v: {
                                                chainId: endpoint.chainId,
                                                url: endpoint.url,
                                                responseTime: Date.now() - start,
                                                returnedChainId: returnedChainId,
                                                source: endpoint.source
                                            }
                                        }
                                    ];
                                case 7:
                                    err = _state.sent();
                                    clearTimeout(timeoutId);
                                    errorMessage = err.message || "Unknown error";
                                    statusCode = err.status || err.cause && err.cause.code || "N/A";
                                    debug("Exception testing endpoint: ".concat(endpoint.url, ", status code: ").concat(statusCode, ", error: ").concat(errorMessage));
                                    if (!(attempt < maxRetries)) return [
                                        3,
                                        9
                                    ];
                                    return [
                                        4,
                                        delay(config.RPC_CHECKER_RETRY_DELAY_MS)
                                    ];
                                case 8:
                                    _state.sent();
                                    attempt++;
                                    return [
                                        2,
                                        "continue"
                                    ];
                                case 9:
                                    return [
                                        2,
                                        {
                                            v: null
                                        }
                                    ];
                                case 10:
                                    return [
                                        2
                                    ];
                            }
                        });
                    };
                    attempt = 0;
                    maxRetries = config.RPC_CHECKER_MAX_RETRIES;
                    debug("Testing endpoint: ".concat(endpoint.url));
                    _state.label = 1;
                case 1:
                    if (!(attempt <= maxRetries)) return [
                        3,
                        3
                    ];
                    return [
                        5,
                        _ts_values(_loop())
                    ];
                case 2:
                    _ret = _state.sent();
                    if (_type_of(_ret) === "object") return [
                        2,
                        _ret.v
                    ];
                    return [
                        3,
                        1
                    ];
                case 3:
                    return [
                        2,
                        null
                    ];
            }
        });
    });
    return _testOneRpc.apply(this, arguments);
}
export function testRpcEndpoints(endpoints) {
    return _testRpcEndpoints.apply(this, arguments);
}
function _testRpcEndpoints() {
    _testRpcEndpoints = _async_to_generator(function(endpoints) {
        var concurrency, healthy, queue, activeCount, chainIdMap;
        return _ts_generator(this, function(_state) {
            concurrency = config.RPC_CHECKER_REQUEST_CONCURRENCY;
            healthy = [];
            queue = _to_consumable_array(endpoints);
            activeCount = 0;
            chainIdMap = new Map();
            return [
                2,
                new Promise(function(resolve) {
                    function processNext() {
                        var _loop = function() {
                            var endpoint = queue.shift();
                            activeCount++;
                            debug("Testing endpoint: ".concat(endpoint.url, " (active: ").concat(activeCount, ", remaining: ").concat(queue.length, ")"));
                            testOneRpc(endpoint).then(function(result) {
                                if (result) {
                                    // debug(
                                    //   `Endpoint healthy: ${endpoint.url} (response time: ${result.responseTime}ms, chain ID: ${result.returnedChainId})`,
                                    // );
                                    if (!chainIdMap.has(result.chainId)) {
                                        chainIdMap.set(result.chainId, new Set());
                                    }
                                    chainIdMap.get(result.chainId).add(result.returnedChainId);
                                    healthy.push(result);
                                } else {
                                // debug(`Endpoint unhealthy: ${endpoint.url}`);
                                }
                            }).catch(function(err) {
                                var statusCode = err.status || err.cause && err.cause.code || "N/A";
                                debug("Error testing endpoint ".concat(endpoint.url, ": status code: ").concat(statusCode, ", error: ").concat(err));
                            }).finally(function() {
                                activeCount--;
                                processNext();
                            });
                        };
                        if (queue.length === 0 && activeCount === 0) {
                            var validatedRpcs = new Array();
                            var chainIdMismatchMap = new Map();
                            var rpcsByChain = new Map();
                            healthy.forEach(function(rpc) {
                                if (!rpcsByChain.has(rpc.chainId)) {
                                    rpcsByChain.set(rpc.chainId, []);
                                }
                                rpcsByChain.get(rpc.chainId).push(rpc);
                            });
                            rpcsByChain.forEach(function(rpcs, expectedChainId) {
                                var chainIdCounts = new Map();
                                rpcs.forEach(function(rpc) {
                                    var count = chainIdCounts.get(rpc.returnedChainId) || 0;
                                    chainIdCounts.set(rpc.returnedChainId, count + 1);
                                });
                                var dominantChainId = expectedChainId;
                                var maxCount = 0;
                                chainIdCounts.forEach(function(count, chainId) {
                                    if (count > maxCount) {
                                        maxCount = count;
                                        dominantChainId = chainId;
                                    }
                                });
                                if (dominantChainId !== expectedChainId) {
                                    warn("Chain ID mismatch for chain ".concat(expectedChainId, ": Most RPC endpoints returned ").concat(dominantChainId));
                                    chainIdMismatchMap.set(expectedChainId, [
                                        dominantChainId
                                    ]);
                                }
                                rpcs.forEach(function(rpc) {
                                    if (rpc.returnedChainId === dominantChainId) {
                                        validatedRpcs.push(rpc);
                                    } else {
                                        var mismatches = chainIdMismatchMap.get(expectedChainId) || [];
                                        if (!mismatches.includes(rpc.returnedChainId)) {
                                            mismatches.push(rpc.returnedChainId);
                                            chainIdMismatchMap.set(expectedChainId, mismatches);
                                        }
                                        warn("RPC ".concat(rpc.url, " returned chain ID ").concat(rpc.returnedChainId, " when ").concat(dominantChainId, " was expected"));
                                    }
                                });
                            });
                            resolve({
                                healthyRpcs: validatedRpcs,
                                chainIdMismatches: chainIdMismatchMap
                            });
                            return;
                        }
                        while(queue.length > 0 && activeCount < concurrency)_loop();
                    }
                    processNext();
                })
            ];
        });
    });
    return _testRpcEndpoints.apply(this, arguments);
}
