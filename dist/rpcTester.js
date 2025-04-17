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
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
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
import config from "./constants/config";
import { debug } from "./logger";
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
                        var start, controller, timeoutId, response, json, err;
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
                                        8
                                    ]);
                                    return [
                                        4,
                                        fetch(endpoint.url, {
                                            method: "POST",
                                            headers: {
                                                "Content-Type": "application/json"
                                            },
                                            body: JSON.stringify({
                                                jsonrpc: "2.0",
                                                method: "eth_blockNumber",
                                                params: [],
                                                id: 1
                                            }),
                                            signal: controller.signal,
                                            agent: endpoint.url.startsWith("https") ? httpsAgent : httpAgent
                                        })
                                    ];
                                case 2:
                                    response = _state.sent();
                                    debug("".concat(endpoint.url, " response status: ").concat(response.status));
                                    clearTimeout(timeoutId);
                                    if (!(response.status === 429)) return [
                                        3,
                                        5
                                    ];
                                    if (!(attempt < maxRetries)) return [
                                        3,
                                        4
                                    ];
                                    return [
                                        4,
                                        delay(config.RETRY_DELAY_MS)
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
                                    if (!response.ok) return [
                                        2,
                                        {
                                            v: null
                                        }
                                    ];
                                    return [
                                        4,
                                        response.json()
                                    ];
                                case 6:
                                    json = _state.sent();
                                    if ((json === null || json === void 0 ? void 0 : json.result) && /^0x[0-9A-Fa-f]+$/.test(json.result)) {
                                        return [
                                            2,
                                            {
                                                v: {
                                                    chainId: endpoint.chainId,
                                                    url: endpoint.url,
                                                    responseTime: Date.now() - start
                                                }
                                            }
                                        ];
                                    }
                                    return [
                                        2,
                                        {
                                            v: null
                                        }
                                    ];
                                case 7:
                                    err = _state.sent();
                                    clearTimeout(timeoutId);
                                    return [
                                        2,
                                        {
                                            v: null
                                        }
                                    ];
                                case 8:
                                    return [
                                        2
                                    ];
                            }
                        });
                    };
                    attempt = 0;
                    maxRetries = config.MAX_RETRIES;
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
        var concurrency, healthy, i, remaining, batchSize, slice, settled, successCount, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, s;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    concurrency = config.CONCURRENCY_LIMIT;
                    if (concurrency === 0) {
                        concurrency = endpoints.length;
                    } else if (!concurrency || concurrency < 0) {
                        concurrency = 10;
                    }
                    healthy = [];
                    i = 0;
                    _state.label = 1;
                case 1:
                    if (!(i < endpoints.length)) return [
                        3,
                        3
                    ];
                    remaining = endpoints.length - i;
                    batchSize = Math.min(concurrency, remaining);
                    slice = endpoints.slice(i, i + batchSize);
                    debug("Processing batch of ".concat(slice.length, " endpoints..."));
                    return [
                        4,
                        Promise.allSettled(slice.map(function(e) {
                            return testOneRpc(e);
                        }))
                    ];
                case 2:
                    settled = _state.sent();
                    successCount = settled.filter(function(s) {
                        return s.status === "fulfilled" && s.value;
                    }).length;
                    debug("Batch completed: ".concat(successCount, "/").concat(slice.length, " endpoints healthy"));
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    try {
                        for(_iterator = settled[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                            s = _step.value;
                            if (s.status === "fulfilled" && s.value) {
                                healthy.push(s.value);
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
                    i += batchSize;
                    return [
                        3,
                        1
                    ];
                case 3:
                    return [
                        2,
                        healthy
                    ];
            }
        });
    });
    return _testRpcEndpoints.apply(this, arguments);
}
