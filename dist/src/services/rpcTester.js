"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testRpcEndpoints = testRpcEndpoints;
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const config_1 = __importDefault(require("../constants/config"));
const logger_1 = require("../utils/logger");
const httpAgent = new http_1.default.Agent({ keepAlive: true });
const httpsAgent = new https_1.default.Agent({ keepAlive: true });
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function testOneRpc(endpoint) {
    let attempt = 0;
    const maxRetries = config_1.default.RPC_CHECKER_MAX_RETRIES;
    (0, logger_1.debug)(`Testing endpoint: ${endpoint.url}`);
    while (attempt <= maxRetries) {
        const start = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config_1.default.RPC_REQUEST_TIMEOUT_MS);
        try {
            const options = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "eth_chainId",
                    params: [],
                    id: 1,
                }),
                signal: controller.signal,
            };
            options.agent = endpoint.url.startsWith("https") ? httpsAgent : httpAgent;
            const chainIdResponse = await fetch(endpoint.url, options);
            clearTimeout(timeoutId);
            if (chainIdResponse.status === 429) {
                (0, logger_1.debug)(`Rate limited (status 429) for endpoint: ${endpoint.url}`);
                if (attempt < maxRetries) {
                    await delay(config_1.default.RPC_CHECKER_RETRY_DELAY_MS);
                    attempt++;
                    continue;
                }
                return null;
            }
            if (!chainIdResponse.ok) {
                (0, logger_1.debug)(`Error response for endpoint: ${endpoint.url}, status: ${chainIdResponse.status}, statusText: ${chainIdResponse.statusText}`);
                return null;
            }
            const chainIdJson = (await chainIdResponse.json());
            if (!chainIdJson?.result || !/^0x[0-9A-Fa-f]+$/.test(chainIdJson.result)) {
                (0, logger_1.debug)(`Invalid chainId result from endpoint: ${endpoint.url}`);
                return null;
            }
            const returnedChainId = parseInt(chainIdJson.result, 16).toString();
            return {
                chainId: endpoint.chainId,
                url: endpoint.url,
                responseTime: Date.now() - start,
                returnedChainId,
                source: endpoint.source,
            };
        }
        catch (err) {
            clearTimeout(timeoutId);
            const errorMessage = err.message || "Unknown error";
            const statusCode = err.status || (err.cause && err.cause.code) || "N/A";
            (0, logger_1.debug)(`Exception testing endpoint: ${endpoint.url}, status code: ${statusCode}, error: ${errorMessage}`);
            if (attempt < maxRetries) {
                await delay(config_1.default.RPC_CHECKER_RETRY_DELAY_MS);
                attempt++;
                continue;
            }
            return null;
        }
    }
    return null;
}
async function testRpcEndpoints(endpoints) {
    let concurrency = config_1.default.RPC_CHECKER_REQUEST_CONCURRENCY;
    const healthy = [];
    const queue = [...endpoints];
    let activeCount = 0;
    const chainIdMap = new Map();
    return new Promise(resolve => {
        function processNext() {
            if (queue.length === 0 && activeCount === 0) {
                const validatedRpcs = new Array();
                const chainIdMismatchMap = new Map();
                const rpcsByChain = new Map();
                healthy.forEach(rpc => {
                    if (!rpcsByChain.has(rpc.chainId)) {
                        rpcsByChain.set(rpc.chainId, []);
                    }
                    rpcsByChain.get(rpc.chainId).push(rpc);
                });
                rpcsByChain.forEach((rpcs, expectedChainId) => {
                    const chainIdCounts = new Map();
                    rpcs.forEach(rpc => {
                        const count = chainIdCounts.get(rpc.returnedChainId) || 0;
                        chainIdCounts.set(rpc.returnedChainId, count + 1);
                    });
                    let dominantChainId = expectedChainId;
                    let maxCount = 0;
                    chainIdCounts.forEach((count, chainId) => {
                        if (count > maxCount) {
                            maxCount = count;
                            dominantChainId = chainId;
                        }
                    });
                    if (dominantChainId !== expectedChainId) {
                        (0, logger_1.warn)(`Chain ID mismatch for chain ${expectedChainId}: Most RPC endpoints returned ${dominantChainId}`);
                        chainIdMismatchMap.set(expectedChainId, [dominantChainId]);
                    }
                    rpcs.forEach(rpc => {
                        if (rpc.returnedChainId === dominantChainId) {
                            validatedRpcs.push(rpc);
                        }
                        else {
                            const mismatches = chainIdMismatchMap.get(expectedChainId) || [];
                            if (!mismatches.includes(rpc.returnedChainId)) {
                                mismatches.push(rpc.returnedChainId);
                                chainIdMismatchMap.set(expectedChainId, mismatches);
                            }
                            (0, logger_1.warn)(`RPC ${rpc.url} returned chain ID ${rpc.returnedChainId} when ${dominantChainId} was expected`);
                        }
                    });
                });
                resolve({
                    healthyRpcs: validatedRpcs,
                    chainIdMismatches: chainIdMismatchMap,
                });
                return;
            }
            while (queue.length > 0 && activeCount < concurrency) {
                const endpoint = queue.shift();
                activeCount++;
                (0, logger_1.debug)(`Testing endpoint: ${endpoint.url} (active: ${activeCount}, remaining: ${queue.length})`);
                testOneRpc(endpoint)
                    .then(result => {
                    if (result) {
                        // debug(
                        //   `Endpoint healthy: ${endpoint.url} (response time: ${result.responseTime}ms, chain ID: ${result.returnedChainId})`,
                        // );
                        if (!chainIdMap.has(result.chainId)) {
                            chainIdMap.set(result.chainId, new Set());
                        }
                        chainIdMap.get(result.chainId).add(result.returnedChainId);
                        healthy.push(result);
                    }
                    else {
                        // debug(`Endpoint unhealthy: ${endpoint.url}`);
                    }
                })
                    .catch(err => {
                    const statusCode = err.status || (err.cause && err.cause.code) || "N/A";
                    (0, logger_1.debug)(`Error testing endpoint ${endpoint.url}: status code: ${statusCode}, error: ${err}`);
                })
                    .finally(() => {
                    activeCount--;
                    processNext();
                });
            }
        }
        processNext();
    });
}
