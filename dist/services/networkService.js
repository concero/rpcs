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
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
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
function _object_spread(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        if (enumerableOnly) {
            symbols = symbols.filter(function(sym) {
                return Object.getOwnPropertyDescriptor(object, sym).enumerable;
            });
        }
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
        ownKeys(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
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
import { debug, error, info } from "../utils/logger";
import config from "../constants/config";
export function fetchNetworksData(isMainnet) {
    return _fetchNetworksData.apply(this, arguments);
}
function _fetchNetworksData() {
    _fetchNetworksData = _async_to_generator(function(isMainnet) {
        var networkType, url, response, data, err;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    networkType = isMainnet ? "mainnet" : "testnet";
                    url = config.CONCERO_NETWORKS_DATA_URL_TEMPLATE.replace("${CONCERO_NETWORKS_GITHUB_BASE_URL}", config.CONCERO_NETWORKS_GITHUB_BASE_URL).replace("${networkType}", networkType);
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        4,
                        ,
                        5
                    ]);
                    return [
                        4,
                        fetch(url)
                    ];
                case 2:
                    response = _state.sent();
                    if (!response.ok) {
                        throw new Error("Failed to fetch ".concat(networkType, " networks: ").concat(response.status));
                    }
                    return [
                        4,
                        response.json()
                    ];
                case 3:
                    data = _state.sent();
                    info("Fetched ".concat(Object.keys(data).length, " ").concat(networkType, " networks from Concero"));
                    return [
                        2,
                        data
                    ];
                case 4:
                    err = _state.sent();
                    error("Error fetching ".concat(networkType, " networks: ").concat(err));
                    throw err;
                case 5:
                    return [
                        2
                    ];
            }
        });
    });
    return _fetchNetworksData.apply(this, arguments);
}
export function fetchNetworkDetails(networkName, isMainnet) {
    return _fetchNetworkDetails.apply(this, arguments);
}
function _fetchNetworkDetails() {
    _fetchNetworkDetails = _async_to_generator(function(networkName, isMainnet) {
        var networkType, url, response, data, err;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    networkType = isMainnet ? "mainnet" : "testnet";
                    url = config.CONCERO_NETWORK_DETAILS_URL_TEMPLATE.replace("${CONCERO_NETWORKS_GITHUB_BASE_URL}", config.CONCERO_NETWORKS_GITHUB_BASE_URL).replace("${networkType}", networkType).replace("${networkName}", networkName);
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        4,
                        ,
                        5
                    ]);
                    debug("Fetching details for ".concat(networkName, " (").concat(networkType, ")... from Concero"));
                    return [
                        4,
                        fetch(url)
                    ];
                case 2:
                    response = _state.sent();
                    if (!response.ok) {
                        if (response.status !== 404) {
                            debug("Failed to fetch network details for ".concat(networkName, ": ").concat(response.status));
                        }
                        return [
                            2,
                            null
                        ];
                    }
                    return [
                        4,
                        response.json()
                    ];
                case 3:
                    data = _state.sent();
                    return [
                        2,
                        _object_spread_props(_object_spread({}, data), {
                            networkType: networkType
                        })
                    ];
                case 4:
                    err = _state.sent();
                    debug("Error fetching network details for ".concat(networkName, ": ").concat(err));
                    return [
                        2,
                        null
                    ];
                case 5:
                    return [
                        2
                    ];
            }
        });
    });
    return _fetchNetworkDetails.apply(this, arguments);
}
export function fetchAllNetworkDetails() {
    return _fetchAllNetworkDetails.apply(this, arguments);
}
function _fetchAllNetworkDetails() {
    _fetchAllNetworkDetails = _async_to_generator(function() {
        var result;
        function processNetworks(isMainnet) {
            return _processNetworks.apply(this, arguments);
        }
        function _processNetworks() {
            _processNetworks = _async_to_generator(function(isMainnet) {
                var networks, networkType, fetchPromises;
                return _ts_generator(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            return [
                                4,
                                fetchNetworksData(isMainnet)
                            ];
                        case 1:
                            networks = _state.sent();
                            networkType = isMainnet ? "mainnet" : "testnet";
                            // info(`Fetching details for ${Object.keys(networks).length} ${networkType} networks...`);
                            fetchPromises = Object.entries(networks).map(/*#__PURE__*/ function() {
                                var _ref = _async_to_generator(function(param) {
                                    var _param, networkName, network, details;
                                    return _ts_generator(this, function(_state) {
                                        switch(_state.label){
                                            case 0:
                                                _param = _sliced_to_array(param, 2), networkName = _param[0], network = _param[1];
                                                return [
                                                    4,
                                                    fetchNetworkDetails(networkName, isMainnet)
                                                ];
                                            case 1:
                                                details = _state.sent();
                                                if (details) {
                                                    result[network.chainId.toString()] = details;
                                                }
                                                return [
                                                    2
                                                ];
                                        }
                                    });
                                });
                                return function(_) {
                                    return _ref.apply(this, arguments);
                                };
                            }());
                            return [
                                4,
                                Promise.all(fetchPromises)
                            ];
                        case 2:
                            _state.sent();
                            return [
                                2
                            ];
                    }
                });
            });
            return _processNetworks.apply(this, arguments);
        }
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    result = {};
                    if (!(config.NETWORK_MODE === 1 || config.NETWORK_MODE === 2)) return [
                        3,
                        2
                    ];
                    return [
                        4,
                        processNetworks(true)
                    ];
                case 1:
                    _state.sent();
                    _state.label = 2;
                case 2:
                    if (!(config.NETWORK_MODE === 0 || config.NETWORK_MODE === 2)) return [
                        3,
                        4
                    ];
                    return [
                        4,
                        processNetworks(false)
                    ];
                case 3:
                    _state.sent();
                    _state.label = 4;
                case 4:
                    info("Fetched details for ".concat(Object.keys(result).length, " networks from Concero"));
                    return [
                        2,
                        result
                    ];
            }
        });
    });
    return _fetchAllNetworkDetails.apply(this, arguments);
}
