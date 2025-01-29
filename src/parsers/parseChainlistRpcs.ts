import { parse } from "acorn";
import { simple } from "acorn-walk";
import config from "../constants/config";
interface JSNode {
    type: string;
    [key: string]: any;
}

function isWssUrl(value: any): boolean {
    if (typeof value === "string" && value.startsWith("wss://")) return true;
    if (
        value &&
        typeof value === "object" &&
        typeof value.url === "string" &&
        value.url.startsWith("wss://")
    ) {
        return true;
    }
    return false;
}

function parseValue(node: JSNode): any {
    if (!node) return undefined;
    if (node.type === "ObjectExpression") {
        const obj: Record<string, any> = {};
        for (const prop of node.properties) {
            if (prop.type !== "Property") continue;
            const keyNode = prop.key;
            const key =
                keyNode.type === "Identifier" ? keyNode.name : keyNode.value;
            if (key === "tracking" || key === "trackingDetails") continue;
            const val = parseValue(prop.value);
            if (!isWssUrl(val)) obj[key] = val;
        }
        // If the entire object itself represents a single RPC endpoint
        // (and has a wss:// url), then skip the entire object by returning undefined.
        if (isWssUrl(obj)) return undefined;
        return obj;
    }
    if (node.type === "ArrayExpression") {
        const arr: any[] = [];
        for (const elem of node.elements) {
            const val = parseValue(elem);
            if (val !== undefined && !isWssUrl(val)) {
                arr.push(val);
            }
        }
        return arr;
    }
    if (node.type === "Literal") {
        return node.value;
    }
    return undefined;
}

export default function parseChainlistRpcs(
    jsFileContent: string,
): Record<string, any> {
    const marker = "export const extraRpcs =";
    const idx = jsFileContent.indexOf(marker);
    const contentToParse =
        idx !== -1 ? jsFileContent.substring(idx) : jsFileContent;

    const ast = parse(contentToParse, {
        ecmaVersion: "latest",
        sourceType: "module",
    });

    let extraRpcsNode: JSNode | null = null;
    simple(ast, {
        ExportNamedDeclaration(node: JSNode) {
            if (!node.declaration) return;
            if (node.declaration.type === "VariableDeclaration") {
                for (const decl of node.declaration.declarations) {
                    if (
                        decl.id.type === "Identifier" &&
                        decl.id.name === "extraRpcs" &&
                        decl.init?.type === "ObjectExpression"
                    ) {
                        extraRpcsNode = decl.init;
                    }
                }
            }
        },
    });

    if (!extraRpcsNode) {
        throw new Error(
            "Could not find `export const extraRpcs = {...}` in the file.",
        );
    }

    const parsed = parseValue(extraRpcsNode);
    if (!parsed || typeof parsed !== "object") {
        throw new Error("Parsed `extraRpcs` is not an object.");
    }

    if (config.WHITELISTED_CHAIN_IDS.length === 0) {
        return parsed;
    }

    return Object.fromEntries(
        Object.entries(parsed).filter(([chainId]) =>
            config.WHITELISTED_CHAIN_IDS.includes(parseInt(chainId, 10)),
        ),
    );
}
