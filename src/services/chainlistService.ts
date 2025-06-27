import { parse } from "acorn";
import { simple } from "acorn-walk";
import { debug } from "../utils/logger";
import config from "../constants/config";

interface JSNode {
  type: string;
  [key: string]: any;
}

export async function fetchChainlistRpcs() {
  const response = await fetch(config.URLS.CHAINLIST_URL);
  const data = await response.text();
  return data;
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
      const key = keyNode.type === "Identifier" ? keyNode.name : keyNode.value;
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
      if (elem.type === "Literal" && typeof elem.value === "string") {
        // Direct string RPC URL
        arr.push(elem.value);
      } else {
        // Object RPC or other value
        const val = parseValue(elem);
        if (val !== undefined && !isWssUrl(val)) {
          arr.push(val);
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

export function parseChainlistRpcs(jsFileContent: string): Record<string, any> {
  const marker = "export const extraRpcs =";
  const idx = jsFileContent.indexOf(marker);
  const contentToParse = idx !== -1 ? jsFileContent.substring(idx) : jsFileContent;

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
    throw new Error("Could not find `export const extraRpcs = {...}` in the file.");
  }

  const parsed = parseValue(extraRpcsNode);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Parsed `extraRpcs` is not an object.");
  }

  // Post-processing to ensure all RPC endpoints are properly formatted as strings
  for (const chainId in parsed) {
    if (parsed[chainId] && parsed[chainId].rpcs) {
      debug(`Processing RPCs for chainId ${chainId}`);

      // Transform the RPCs array to extract URLs from objects when needed
      parsed[chainId].rpcs = parsed[chainId].rpcs
        .map((rpc: any) => {
          if (typeof rpc === "string") {
            debug(`Found string RPC: ${rpc}`);
            return rpc;
          } else if (rpc && typeof rpc === "object" && typeof rpc.url === "string") {
            debug(`Found object RPC with URL: ${rpc.url}`);
            return rpc.url;
          } else {
            debug(`Found unknown RPC format: ${JSON.stringify(rpc)}`);
            return null;
          }
        })
        .filter(Boolean); // Remove any null entries

      debug(`Parsed Chainlist urls: ${JSON.stringify(parsed[chainId].rpcs)}`);
    }
  }

  return parsed;
}
