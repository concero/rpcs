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
import { parse } from "acorn";
import { simple } from "acorn-walk";
import { debug } from "../utils/logger";
import config from "../constants/config";
export function fetchChainlistRpcs() {
    return _fetchChainlistRpcs.apply(this, arguments);
}
function _fetchChainlistRpcs() {
    _fetchChainlistRpcs = _async_to_generator(function() {
        var response, data;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        fetch(config.CHAINLIST_URL)
                    ];
                case 1:
                    response = _state.sent();
                    return [
                        4,
                        response.text()
                    ];
                case 2:
                    data = _state.sent();
                    return [
                        2,
                        data
                    ];
            }
        });
    });
    return _fetchChainlistRpcs.apply(this, arguments);
}
function isWssUrl(value) {
    if (typeof value === "string" && value.startsWith("wss://")) return true;
    if (value && (typeof value === "undefined" ? "undefined" : _type_of(value)) === "object" && typeof value.url === "string" && value.url.startsWith("wss://")) {
        return true;
    }
    return false;
}
function parseValue(node) {
    if (!node) return undefined;
    if (node.type === "ObjectExpression") {
        var obj = {};
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = node.properties[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var prop = _step.value;
                if (prop.type !== "Property") continue;
                var keyNode = prop.key;
                var key = keyNode.type === "Identifier" ? keyNode.name : keyNode.value;
                if (key === "tracking" || key === "trackingDetails") continue;
                var val = parseValue(prop.value);
                if (!isWssUrl(val)) obj[key] = val;
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
        // If the entire object itself represents a single RPC endpoint
        // (and has a wss:// url), then skip the entire object by returning undefined.
        if (isWssUrl(obj)) return undefined;
        return obj;
    }
    if (node.type === "ArrayExpression") {
        var arr = [];
        var _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
        try {
            for(var _iterator1 = node.elements[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                var elem = _step1.value;
                if (elem.type === "Literal" && typeof elem.value === "string") {
                    // Direct string RPC URL
                    arr.push(elem.value);
                } else {
                    // Object RPC or other value
                    var val1 = parseValue(elem);
                    if (val1 !== undefined && !isWssUrl(val1)) {
                        arr.push(val1);
                    }
                }
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
        return arr;
    }
    if (node.type === "Literal") {
        return node.value;
    }
    return undefined;
}
export function parseChainlistRpcs(jsFileContent) {
    var marker = "export const extraRpcs =";
    var idx = jsFileContent.indexOf(marker);
    var contentToParse = idx !== -1 ? jsFileContent.substring(idx) : jsFileContent;
    var ast = parse(contentToParse, {
        ecmaVersion: "latest",
        sourceType: "module"
    });
    var extraRpcsNode = null;
    simple(ast, {
        ExportNamedDeclaration: function ExportNamedDeclaration(node) {
            if (!node.declaration) return;
            if (node.declaration.type === "VariableDeclaration") {
                var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                try {
                    for(var _iterator = node.declaration.declarations[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                        var decl = _step.value;
                        var _decl_init;
                        if (decl.id.type === "Identifier" && decl.id.name === "extraRpcs" && ((_decl_init = decl.init) === null || _decl_init === void 0 ? void 0 : _decl_init.type) === "ObjectExpression") {
                            extraRpcsNode = decl.init;
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
            }
        }
    });
    if (!extraRpcsNode) {
        throw new Error("Could not find `export const extraRpcs = {...}` in the file.");
    }
    var parsed = parseValue(extraRpcsNode);
    if (!parsed || (typeof parsed === "undefined" ? "undefined" : _type_of(parsed)) !== "object") {
        throw new Error("Parsed `extraRpcs` is not an object.");
    }
    // Post-processing to ensure all RPC endpoints are properly formatted as strings
    for(var chainId in parsed){
        if (parsed[chainId] && parsed[chainId].rpcs) {
            debug("Processing RPCs for chainId ".concat(chainId));
            // Transform the RPCs array to extract URLs from objects when needed
            parsed[chainId].rpcs = parsed[chainId].rpcs.map(function(rpc) {
                if (typeof rpc === "string") {
                    debug("Found string RPC: ".concat(rpc));
                    return rpc;
                } else if (rpc && (typeof rpc === "undefined" ? "undefined" : _type_of(rpc)) === "object" && typeof rpc.url === "string") {
                    debug("Found object RPC with URL: ".concat(rpc.url));
                    return rpc.url;
                } else {
                    debug("Found unknown RPC format: ".concat(JSON.stringify(rpc)));
                    return null;
                }
            }).filter(Boolean); // Remove any null entries
            debug("Parsed Chainlist urls: ".concat(JSON.stringify(parsed[chainId].rpcs)));
        }
    }
    return parsed;
}
