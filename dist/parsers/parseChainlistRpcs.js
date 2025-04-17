function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
import { parse } from "acorn";
import { simple } from "acorn-walk";
import { debug } from "../logger";
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
export default function parseChainlistRpcs(jsFileContent) {
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
            debug("Before processing: ".concat(JSON.stringify(parsed[chainId].rpcs)));
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
            debug("After processing: ".concat(JSON.stringify(parsed[chainId].rpcs)));
        }
    }
    return parsed;
}
