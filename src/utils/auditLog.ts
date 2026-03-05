import fs from "fs";
import path from "path";
import type { HealthyRpc, NetworkDetails } from "../types";

interface RpcAuditChainEntry {
  chainId: number;
  timestamp: number;
  rpcUrls: {
    rpc: string;
    params: {
      getLogsBlockDepth: number;
      maxBatchSize: number;
      error: string;
    };
  }[];
}

export type RpcAuditRecord = Record<string, RpcAuditChainEntry>;

export function buildAuditEntries(
  batchMap: Map<string, HealthyRpc[]>,
  depthMap: Map<string, HealthyRpc[]>,
  batchErrors: Map<string, string>,
  depthErrors: Map<string, string>,
  networks: Record<string, NetworkDetails>,
): RpcAuditRecord {
  const timestamp = Date.now();
  const allChainIds = new Set([...batchMap.keys(), ...depthMap.keys()]);
  const entries: RpcAuditRecord = {};

  for (const chainId of allChainIds) {
    const network = Object.values(networks).find(n => n.chainId.toString() === chainId);
    const name = network?.name ?? chainId;

    const batchByUrl = new Map((batchMap.get(chainId) ?? []).map(r => [r.url, r]));
    const depthByUrl = new Map((depthMap.get(chainId) ?? []).map(r => [r.url, r]));
    const allUrls = new Set([...batchByUrl.keys(), ...depthByUrl.keys()]);

    const rpcUrls = [...allUrls].map(url => {
      const batchError = batchErrors.get(url) ?? "";
      const depthError = depthErrors.get(url) ?? "";
      const error = [batchError, depthError].filter(Boolean).join(" | ");

      return {
        rpc: url,
        params: {
          getLogsBlockDepth: depthByUrl.get(url)?.getLogsBlockDepth ?? 0,
          maxBatchSize: batchByUrl.get(url)?.maxBatchSize ?? 0,
          error,
        },
      };
    });

    entries[name] = { chainId: Number(chainId), timestamp, rpcUrls };
  }

  return entries;
}

export function appendAuditEntries(entries: RpcAuditRecord, outputDir: string): void {
  if (Object.keys(entries).length === 0) return;

  const filePath = path.join(outputDir, "rpc-audit.jsonl");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  fs.appendFileSync(filePath, JSON.stringify(entries) + "\n", "utf-8");
}
