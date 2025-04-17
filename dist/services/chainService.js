function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
    if (Array.isArray(arr)) return arr;
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
import config from "../constants/config";
export function getSupportedChainIds(networkDetails) {
    return Object.keys(networkDetails);
}
export function filterChainlistChains(rawChainlistRpcs, supportedChainIds) {
    return Object.fromEntries(Object.entries(rawChainlistRpcs).filter(function(param) {
        var _param = _sliced_to_array(param, 1), chainId = _param[0];
        return supportedChainIds.includes(chainId) && !config.IGNORED_CHAINLIST_CHAIN_IDS.includes(parseInt(chainId, 10));
    }));
}
export function filterEthereumListsChains(rawEthereumListsChains, supportedChainIds) {
    return Object.fromEntries(Object.entries(rawEthereumListsChains).filter(function(param) {
        var _param = _sliced_to_array(param, 1), chainId = _param[0];
        return supportedChainIds.includes(chainId) && !config.IGNORED_ETHEREUM_LISTS_CHAIN_IDS.includes(parseInt(chainId, 10));
    }));
}
export function extractEthereumListsEndpoints(ethereumListsChains) {
    return Object.entries(ethereumListsChains).flatMap(function(param) {
        var _param = _sliced_to_array(param, 2), chainId = _param[0], chain = _param[1];
        return chain.rpc.filter(function(url) {
            return url.startsWith("http");
        }).map(function(url) {
            return {
                chainId: chainId,
                url: url,
                source: "ethereum-lists"
            };
        });
    });
}
export function extractChainlistEndpoints(chainlistRpcs) {
    return Object.entries(chainlistRpcs).flatMap(function(param) {
        var _param = _sliced_to_array(param, 2), chainId = _param[0], rpcs = _param[1].rpcs;
        return rpcs.map(function(rpc) {
            return {
                chainId: chainId,
                url: rpc,
                source: "chainlist"
            };
        });
    });
}
export function extractNetworkEndpoints(networkDetails) {
    return Object.entries(networkDetails).filter(function(param) {
        var _param = _sliced_to_array(param, 2), _ = _param[0], details = _param[1];
        return details.rpcs && details.rpcs.length > 0;
    }).flatMap(function(param) {
        var _param = _sliced_to_array(param, 2), chainId = _param[0], details = _param[1];
        return details.rpcs.filter(function(url) {
            return url && url.startsWith("http");
        }).map(function(url) {
            return {
                chainId: chainId,
                url: url,
                source: "v2-networks"
            };
        });
    });
}
export function sortRpcs(testedRpcs) {
    var rpcsByChain = new Map();
    testedRpcs.forEach(function(rpc) {
        if (!rpcsByChain.has(rpc.chainId)) {
            rpcsByChain.set(rpc.chainId, []);
        }
        rpcsByChain.get(rpc.chainId).push(rpc);
    });
    rpcsByChain.forEach(function(rpcs) {
        return rpcs.sort(function(a, b) {
            return a.responseTime - b.responseTime;
        });
    });
    return rpcsByChain;
}
export function getNetworkDetails(chainId, networkDetails) {
    return networkDetails[chainId];
}
