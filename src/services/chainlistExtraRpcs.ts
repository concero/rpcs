import { parse } from "acorn";
import { simple } from "acorn-walk";
import config from "../constants/config";
import { ChainlistRpcs } from "../types";

interface JSNode {
  type: string;
  [key: string]: any;
}

export async function fetchChainlistExtraRpcs(): Promise<string> {
  const response = await fetch(config.URLS.CHAINLIST_EXTRA_RPCS_URL);
  return response.text();
}

export function parseChainlistExtraRpcs(jsFileContent: string): ChainlistRpcs {
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
  const result: ChainlistRpcs = {};

  for (const chainId in parsed) {
    if (parsed[chainId] && parsed[chainId].rpcs) {

      // Transform the RPCs array to extract URLs from objects when needed
      const rpcs = parsed[chainId].rpcs
        .map((rpc: any) => {
          if (typeof rpc === "string") {
            return rpc;
          } else if (rpc && typeof rpc === "object" && typeof rpc.url === "string") {
            return rpc.url;
          } else {
            // debug(`Found unknown RPC format: ${JSON.stringify(rpc)} for chain ${chainId}`);
            return null;
          }
        })
        .filter(Boolean); // Remove any null entries

      if (rpcs.length > 0) {
        result[chainId] = {
          rpcs,
          name: parsed[chainId].name,
          shortName: parsed[chainId].shortName,
          chain: parsed[chainId].chain,
        };
      }
    }
  }

  return result;
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
