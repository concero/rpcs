import http from "http";
import https from "https";
import {
  HealthyRpc,
  JsonRpcResponse,
  NodeFetchOptions,
  RpcEndpoint,
  RpcTestResult,
  RpcTestStepResult, // Assuming this type is defined appropriately
} from "../types"; // Adjust path as needed
import { debug, info, warn, error } from "../utils/logger"; // Adjust path as needed
import { endpointFailureTracker, EndpointFailureDetails } from "./endpointFailureTracker";

// Define a more specific configuration type
interface RpcTesterConfig {
  HTTP_REQUEST_CONCURRENCY: number;
  ENDPOINT_MAX_DURATION_MS: number;
  LOG_INTERVAL_MS: number;

  MAX_RETRIES: number;
  RETRY_DELAY_MS: number;
  EXPONENTIAL_BACKOFF: boolean;
  MAX_RETRY_AFTER_TIMEOUT_MS: number;
  HTTP_REQUEST_TIMEOUT_MS: number; // For individual fetch calls
  JSON_PARSE_TIMEOUT_MS: number; // For parsing JSON response
}

// Define a logger interface for dependency injection (optional, but good practice)
interface Logger {
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

// Create persistent HTTP agents for better performance
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

interface EndpointTesterStatus {
  url: string;
  expectedChainId: string;
  chainId?: string;
  startTime: number;
  currentStage: string; // e.g., "chainId", "blockNumber", "getLogs", "delaying", "finished", "failed"
  attempt: number;
  isWaiting: boolean;
  waitUntil: number | null;
  lastRetryAfterMs: number | null;
  failureReason?: string;
  failureResponse?: any;
  failureError?: string;
  failureHttpStatus?: number;
  failureHttpStatusText?: string;
  failureResponseTime?: number;
}

class EndpointTester {
  private readonly endpoint: RpcEndpoint;
  private readonly config: RpcTesterConfig;
  private readonly logger: Logger;

  private startTime: number = 0;
  private currentStage: string = "idle";
  private currentAttempt: number = 0;
  private isWaiting: boolean = false;
  private waitUntil: number | null = null;
  private lastRetryAfterMs: number | null = null;
  private failureReason?: string;
  private failureResponse?: any;
  private failureError?: string;
  private failureHttpStatus?: number;
  private failureHttpStatusText?: string;
  private failureResponseTime?: number;

  /**
   * @dev Initializes a new EndpointTester.
   * @param endpoint The RPC endpoint configuration.
   * @param config The tester configuration.
   * @param logger A logger instance.
   */
  constructor(endpoint: RpcEndpoint, config: RpcTesterConfig, logger: Logger) {
    this.endpoint = endpoint;
    this.config = config;
    this.logger = logger;

    // Ensure initialization of failure tracker
    endpointFailureTracker;
  }

  /**
   * @dev Provides the current status of this endpoint tester.
   * @returns The current status.
   */
  public getStatus(): EndpointTesterStatus {
    return {
      url: this.endpoint.url,
      expectedChainId: this.endpoint.chainId,
      startTime: this.startTime,
      currentStage: this.currentStage,
      attempt: this.currentAttempt,
      isWaiting: this.isWaiting,
      waitUntil: this.waitUntil,
      lastRetryAfterMs: this.lastRetryAfterMs,
      failureReason: this.failureReason,
      failureResponse: this.failureResponse,
      failureError: this.failureError,
      failureHttpStatus: this.failureHttpStatus,
      failureHttpStatusText: this.failureHttpStatusText,
      failureResponseTime: this.failureResponseTime,
    };
  }

  private async delayAndUpdateStatus(ms: number): Promise<void> {
    this.isWaiting = true;
    this.waitUntil = Date.now() + ms;
    this.currentStage = "delaying";
    this.logger.debug(`[RPC:${this.endpoint.url}] Delaying for ${ms}ms`);
    return new Promise(resolve => {
      setTimeout(() => {
        this.isWaiting = false;
        this.waitUntil = null;
        this.logger.debug(`[RPC:${this.endpoint.url}] Delay complete`);
        resolve();
      }, ms);
    });
  }

  /**
   * @dev Makes a JSON-RPC request with timeout and error handling.
   * @param method The RPC method name.
   * @param params The parameters for the RPC method.
   * @returns A promise resolving to the test step result.
   */
  private async makeRpcRequest(
    method: string,
    params: any[] = [],
  ): Promise<RpcTestStepResult & { httpStatus?: number; httpStatusText?: string }> {
    this.isWaiting = false;
    const controller = new AbortController();
    const timeoutMs = this.config.HTTP_REQUEST_TIMEOUT_MS;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        controller.abort();
        reject(
          new Error(
            `Hard timeout after ${timeoutMs}ms for ${method} request to ${this.endpoint.url}`,
          ),
        );
      }, timeoutMs);
    });

    const requestStartTime = Date.now();
    this.logger.debug(
      `[RPC:${this.endpoint.url}] Making ${method} request (Attempt: ${this.currentAttempt})`,
    );

    try {
      const options: NodeFetchOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method,
          params,
          id: 1, // Static ID is fine for non-batch requests
        }),
        signal: controller.signal,
        agent: this.endpoint.url.startsWith("https") ? httpsAgent : httpAgent,
      };

      const response = await Promise.race([fetch(this.endpoint.url, options), timeoutPromise]);

      if (Date.now() - requestStartTime > timeoutMs && !controller.signal.aborted) {
        controller.abort(); // Ensure abortion if timeout was close
        throw new Error(`Request exceeded timeout of ${timeoutMs}ms but didn't abort properly`);
      }

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfterSeconds = parseInt(retryAfterHeader || "0", 10);
        const retryAfter = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : null;
        this.logger.info(
          `[RPC:${this.endpoint.url}] Rate limited (429) for ${method}. Retry-After: ${retryAfter ? retryAfter + "ms" : "not specified"}`,
        );
        this.failureReason = "Rate Limited";
        this.failureHttpStatus = response.status;
        this.failureHttpStatusText = response.statusText;
        this.failureResponseTime = Date.now() - requestStartTime;

        // Try to capture response body if available
        try {
          const responseText = await response.text();
          this.failureResponse = responseText;
        } catch (err) {
          this.failureResponse = "Failed to capture response body";
        }

        return {
          success: false,
          rateLimited: true,
          retryAfter,
          httpStatus: response.status,
          httpStatusText: response.statusText,
        };
      }

      if (!response.ok) {
        this.logger.warn(
          `[RPC:${this.endpoint.url}] Error for ${method}: ${response.status} ${response.statusText}`,
        );
        this.failureReason = "HTTP Error";
        this.failureHttpStatus = response.status;
        this.failureHttpStatusText = response.statusText;
        this.failureResponseTime = Date.now() - requestStartTime;

        // Try to capture response body if available
        try {
          const responseText = await response.text();
          this.failureResponse = responseText;
        } catch (err) {
          this.failureResponse = "Failed to capture response body";
        }

        return {
          success: false,
          rateLimited: false,
          httpStatus: response.status,
          httpStatusText: response.statusText,
        };
      }

      const jsonParseTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`JSON parsing timeout for ${this.endpoint.url}`));
        }, this.config.JSON_PARSE_TIMEOUT_MS);
      });

      const jsonResult = (await Promise.race([
        response.json(),
        jsonParseTimeoutPromise,
      ])) as JsonRpcResponse;

      const responseTime = Date.now() - requestStartTime;
      this.logger.debug(`[RPC:${this.endpoint.url}] ${method} success in ${responseTime}ms`);
      return { success: true, jsonResult, responseTime };
    } catch (err: any) {
      const responseTime = Date.now() - requestStartTime;
      const errorMessage = err.message || "Unknown error";
      const isTimeout = err.name === "AbortError" || errorMessage.includes("timeout");

      this.logger.warn(
        `[RPC:${this.endpoint.url}] ${isTimeout ? "Timeout" : "Exception"} for ${method} after ${responseTime}ms: ${errorMessage}`,
      );

      this.failureReason = isTimeout ? "Timeout" : "Exception";
      this.failureError = errorMessage;
      this.failureResponseTime = responseTime;

      return {
        success: false,
        rateLimited: false,
        error: errorMessage,
        isTimeout,
        responseTime,
      };
    }
  }

  /**
   * @dev Executes a given test function with retry logic.
   * @param testFn The function performing a single test step.
   * @param methodName The name of the RPC method being tested (for logging).
   * @returns The result of the test function, or null if all retries fail.
   */
  private async executeWithRetries<T extends RpcTestStepResult>(
    testFn: () => Promise<T>,
    methodName: string,
  ): Promise<T | null> {
    this.currentAttempt = 0;
    this.lastRetryAfterMs = null;
    this.isWaiting = false;

    while (this.currentAttempt <= this.config.MAX_RETRIES) {
      this.currentAttempt++;
      this.currentStage = methodName;
      const result = await testFn();

      if (result.success) {
        return result;
      }

      if (this.currentAttempt > this.config.MAX_RETRIES) {
        this.logger.warn(
          `[RPC:${this.endpoint.url}] All ${methodName} attempts failed. Max retries reached.`,
        );

        // Log the final failure details
        endpointFailureTracker.recordFailureFromResponse(
          this.endpoint.url,
          this.endpoint.chainId,
          methodName,
          result,
          this.currentAttempt,
          Date.now() - this.startTime,
        );

        break;
      }

      let delayMs: number;
      if (result.rateLimited) {
        const effectiveRetryAfter =
          result.retryAfter ||
          (this.config.EXPONENTIAL_BACKOFF
            ? this.config.RETRY_DELAY_MS * Math.pow(2, this.currentAttempt - 1)
            : this.config.RETRY_DELAY_MS);

        this.lastRetryAfterMs = effectiveRetryAfter;

        if (effectiveRetryAfter > this.config.MAX_RETRY_AFTER_TIMEOUT_MS) {
          this.logger.warn(
            `[RPC:${this.endpoint.url}] Rate limited with Retry-After ${effectiveRetryAfter}ms, exceeding max ${this.config.MAX_RETRY_AFTER_TIMEOUT_MS}ms. Failing.`,
          );

          // Log the rate limit failure
          endpointFailureTracker.recordFailureFromResponse(
            this.endpoint.url,
            this.endpoint.chainId,
            methodName,
            result,
            this.currentAttempt,
            Date.now() - this.startTime,
          );

          return null;
        }
        delayMs = effectiveRetryAfter;
        this.logger.info(
          `[RPC:${this.endpoint.url}] Rate limited on ${methodName}. Retrying in ${delayMs}ms (Attempt ${this.currentAttempt}/${this.config.MAX_RETRIES + 1})`,
        );
      } else {
        delayMs = this.config.EXPONENTIAL_BACKOFF
          ? this.config.RETRY_DELAY_MS * Math.pow(2, this.currentAttempt - 1)
          : this.config.RETRY_DELAY_MS;
        this.lastRetryAfterMs = delayMs;
        this.logger.warn(
          `[RPC:${this.endpoint.url}] ${methodName} test failed. Retrying in ${delayMs}ms (Attempt ${this.currentAttempt}/${this.config.MAX_RETRIES + 1})`,
        );
      }
      await this.delayAndUpdateStatus(delayMs);
    }
    return null;
  }

  private async performChainIdTest(): Promise<RpcTestStepResult & { returnedChainId?: string }> {
    this.isWaiting = false;
    const result = await this.makeRpcRequest("eth_chainId");
    if (!result.success || !result.jsonResult) return result;

    const chainIdHex = result.jsonResult.result;
    if (!chainIdHex || !/^0x[0-9A-Fa-f]+$/i.test(String(chainIdHex))) {
      this.logger.warn(`[RPC:${this.endpoint.url}] Invalid chainId response: ${chainIdHex}`);
      this.failureReason = "Invalid chainId format";
      this.failureResponse = result.jsonResult;
      return { ...result, success: false };
    }
    const returnedChainId = parseInt(String(chainIdHex), 16).toString();
    return { ...result, returnedChainId };
  }

  private async performBlockNumberTest(): Promise<RpcTestStepResult & { blockNumber?: number }> {
    this.isWaiting = false;
    const result = await this.makeRpcRequest("eth_blockNumber");
    if (!result.success || !result.jsonResult) return result;

    const blockNumberHex = result.jsonResult.result;
    if (!blockNumberHex || !/^0x[0-9A-Fa-f]+$/i.test(String(blockNumberHex))) {
      this.logger.warn(
        `[RPC:${this.endpoint.url}] Invalid blockNumber response: ${blockNumberHex}`,
      );
      this.failureReason = "Invalid blockNumber format";
      this.failureResponse = result.jsonResult;
      return { ...result, success: false };
    }
    const blockNumber = parseInt(String(blockNumberHex), 16);
    return { ...result, blockNumber };
  }

  private async performGetLogsTest(latestBlockNumber: number): Promise<RpcTestStepResult> {
    this.isWaiting = false;
    const fromBlock = Math.max(0, latestBlockNumber - 10); // Look back 10 blocks
    const params = [
      {
        fromBlock: `0x${fromBlock.toString(16)}`,
        toBlock: `0x${latestBlockNumber.toString(16)}`,
      },
    ];
    const result = await this.makeRpcRequest("eth_getLogs", params);
    if (!result.success || !result.jsonResult) return result;

    if (!Array.isArray(result.jsonResult.result)) {
      this.logger.warn(
        `[RPC:${this.endpoint.url}] Invalid getLogs response: ${result.jsonResult.result}`,
      );
      this.failureReason = "Invalid getLogs response format";
      this.failureResponse = result.jsonResult;
      return { ...result, success: false };
    }
    this.logger.debug(
      `[RPC:${this.endpoint.url}] eth_getLogs returned ${result.jsonResult.result.length} logs`,
    );
    return result;
  }

  /**
   * @dev Runs all tests for the configured endpoint.
   * @returns A promise resolving to a HealthyRpc object if successful, otherwise null.
   */
  public async test(): Promise<HealthyRpc | null> {
    this.startTime = Date.now();
    this.isWaiting = false;
    this.logger.info(
      `[RPC:${this.endpoint.url}] Starting tests for chain ${this.endpoint.chainId}.`,
    );

    try {
      const chainIdResult = await this.executeWithRetries(
        () => this.performChainIdTest(),
        "eth_chainId",
      );
      if (
        !chainIdResult?.success ||
        typeof chainIdResult.returnedChainId !== "string" ||
        typeof chainIdResult.responseTime !== "number"
      ) {
        this.currentStage = "failed";
        if (!this.failureReason) {
          this.failureReason = "eth_chainId test failed";
        }

        // Log detailed failure for eth_chainId test
        endpointFailureTracker.logFailure({
          url: this.endpoint.url,
          chainId: chainIdResult?.returnedChainId || "unknown",
          expectedChainId: this.endpoint.chainId,
          timestamp: Date.now(),
          stage: "eth_chainId",
          reason: this.failureReason,
          responseData: chainIdResult?.jsonResult,
          errorMessage: chainIdResult?.error,
          httpStatus: chainIdResult?.httpStatus,
          httpStatusText: chainIdResult?.httpStatusText,
          responseTime: chainIdResult?.responseTime,
          attempts: this.currentAttempt,
          testDuration: Date.now() - this.startTime,
        });

        return null;
      }

      const blockNumberResult = await this.executeWithRetries(
        () => this.performBlockNumberTest(),
        "eth_blockNumber",
      );
      if (
        !blockNumberResult?.success ||
        typeof blockNumberResult.blockNumber !== "number" ||
        typeof blockNumberResult.responseTime !== "number"
      ) {
        this.currentStage = "failed";
        if (!this.failureReason) {
          this.failureReason = "eth_blockNumber test failed";
        }

        // Log detailed failure for eth_blockNumber test
        endpointFailureTracker.logFailure({
          url: this.endpoint.url,
          chainId: chainIdResult.returnedChainId || "unknown",
          expectedChainId: this.endpoint.chainId,
          timestamp: Date.now(),
          stage: "eth_blockNumber",
          reason: this.failureReason,
          responseData: blockNumberResult?.jsonResult,
          errorMessage: blockNumberResult?.error,
          httpStatus: blockNumberResult?.httpStatus,
          httpStatusText: blockNumberResult?.httpStatusText,
          responseTime: blockNumberResult?.responseTime,
          attempts: this.currentAttempt,
          testDuration: Date.now() - this.startTime,
        });

        return null;
      }

      const getLogsResult = await this.executeWithRetries(
        () => this.performGetLogsTest(blockNumberResult.blockNumber!),
        "eth_getLogs",
      );
      if (!getLogsResult?.success || typeof getLogsResult.responseTime !== "number") {
        this.currentStage = "failed";
        if (!this.failureReason) {
          this.failureReason = "eth_getLogs test failed";
        }

        // Log detailed failure for eth_getLogs test
        endpointFailureTracker.logFailure({
          url: this.endpoint.url,
          chainId: chainIdResult.returnedChainId || "unknown",
          expectedChainId: this.endpoint.chainId,
          timestamp: Date.now(),
          stage: "eth_getLogs",
          reason: this.failureReason,
          responseData: getLogsResult?.jsonResult,
          errorMessage: getLogsResult?.error,
          httpStatus: getLogsResult?.httpStatus,
          httpStatusText: getLogsResult?.httpStatusText,
          responseTime: getLogsResult?.responseTime,
          attempts: this.currentAttempt,
          testDuration: Date.now() - this.startTime,
        });

        return null;
      }

      const totalResponseTime =
        chainIdResult.responseTime + blockNumberResult.responseTime + getLogsResult.responseTime;

      const totalTestDuration = Date.now() - this.startTime;

      this.logger.info(
        `[RPC:${this.endpoint.url}] All tests passed in ${totalTestDuration}ms. (Total RPC time: ${totalResponseTime}ms)`,
      );
      this.currentStage = "finished";
      return {
        chainId: this.endpoint.chainId, // Expected chainId
        url: this.endpoint.url,
        responseTime: totalResponseTime,
        returnedChainId: chainIdResult.returnedChainId,
        lastBlockNumber: blockNumberResult.blockNumber,
        source: this.endpoint.source,
        chainIdResponse: chainIdResult.jsonResult,
        blockNumberResponse: blockNumberResult.jsonResult,
        getLogsResponse: getLogsResult.jsonResult,
      };
    } catch (e: any) {
      this.logger.warn(
        `[RPC:${this.endpoint.url}] Unexpected error during test execution: ${e.message}`,
      );
      this.currentStage = "failed";
      this.failureReason = "Unexpected error during test execution";
      this.failureError = e.message;

      // Log unexpected test execution errors
      endpointFailureTracker.logFailure({
        url: this.endpoint.url,
        chainId: "unknown",
        expectedChainId: this.endpoint.chainId,
        timestamp: Date.now(),
        stage: this.currentStage,
        reason: this.failureReason,
        errorMessage: e.message,
        attempts: this.currentAttempt,
        testDuration: Date.now() - this.startTime,
      });

      return null;
    }
  }
}

class RpcTester {
  private readonly config: RpcTesterConfig;
  private readonly logger: Logger;
  private activeTesters: Map<string, EndpointTester> = new Map(); // url -> EndpointTester
  private logIntervalId?: NodeJS.Timeout;

  /**
   * @dev Initializes a new RpcTester.
   * @param config The tester configuration.
   * @param logger A logger instance.
   */
  constructor(config: RpcTesterConfig, logger: Logger) {
    this.config = config;

    // Use provided logger or create a default one that uses Node's console
    this.logger = logger || {
      debug: (message: string) => process.stdout.write(`DEBUG: ${message}\n`),
      info: (message: string) => process.stdout.write(`INFO: ${message}\n`),
      warn: (message: string) => process.stderr.write(`WARN: ${message}\n`),
      error: (message: string) => process.stderr.write(`ERROR: ${message}\n`),
    };
  }

  private cleanupTimers(): void {
    if (this.logIntervalId) clearInterval(this.logIntervalId);
    this.logIntervalId = undefined;
  }

  private async logStatus(
    endpointsCount: number,
    queueLength: number,
    healthyCount: number,
    startTime: number,
  ): Promise<void> {
    const now = Date.now();
    const elapsedSeconds = ((now - startTime) / 1000).toFixed(1);
    this.logger.info(
      `Progress: ${healthyCount}/${endpointsCount - queueLength - this.activeTesters.size} tested, ${this.activeTesters.size} active, ${queueLength} queued. Elapsed: ${elapsedSeconds}s`,
    );

    if (this.activeTesters.size > 0) {
      this.logger.debug(`---------- ACTIVE RPC TASKS (${this.activeTesters.size}) ----------`);
      let waitingCount = 0;
      this.activeTesters.forEach(tester => {
        const status = tester.getStatus();
        const durationSeconds = ((now - status.startTime) / 1000).toFixed(1);
        if (status.isWaiting) {
          waitingCount++;
          const remainingWait = status.waitUntil
            ? ((status.waitUntil - now) / 1000).toFixed(1)
            : "N/A";
          this.logger.debug(
            `- ${status.url} (Chain ${status.expectedChainId}): WAITING (stage=${status.currentStage}, attempt=${status.attempt}, remaining=${remainingWait}s, total_dur=${durationSeconds}s, retryAfter=${status.lastRetryAfterMs || "N/A"}ms)`,
          );
        } else {
          this.logger.debug(
            `- ${status.url} (Chain ${status.expectedChainId}): PROCESSING (stage=${status.currentStage}, attempt=${status.attempt}, dur=${durationSeconds}s)`,
          );
        }
      });
      this.logger.debug(`Status Summary: Waiting: ${waitingCount}`);
      this.logger.debug(`------------------------------------------------`);
    }

    // Check for stuck endpoints
    this.activeTesters.forEach((tester, url) => {
      const status = tester.getStatus();
      if (now - status.startTime > this.config.ENDPOINT_MAX_DURATION_MS) {
        this.logger.warn(
          `Endpoint ${url} (Chain ${status.expectedChainId}) active for ${((now - status.startTime) / 1000).toFixed(1)}s, exceeding max ${this.config.ENDPOINT_MAX_DURATION_MS / 1000}s. Marking as failed.`,
        );
        // Log detailed failure information
        const testerStatus = tester.getStatus();
        endpointFailureTracker.logFailure({
          url,
          chainId: testerStatus.chainId || "unknown",
          expectedChainId: testerStatus.expectedChainId,
          timestamp: now,
          stage: testerStatus.currentStage,
          reason: testerStatus.failureReason || "Endpoint max duration exceeded",
          responseData: testerStatus.failureResponse,
          errorMessage: testerStatus.failureError,
          httpStatus: testerStatus.failureHttpStatus,
          httpStatusText: testerStatus.failureHttpStatusText,
          responseTime: testerStatus.failureResponseTime,
          attempts: testerStatus.attempt,
          testDuration: now - testerStatus.startTime,
        });

        // Forcibly remove - the EndpointTester's promise will eventually reject or resolve,
        // but we won't wait for it or count its result.
        this.activeTesters.delete(url);
        // No direct way to abort the EndpointTester's internal fetch from here without
        // a more complex AbortSignal propagation, so we rely on its internal timeouts.
      }
    });
  }

  private validateAndFilterRpcs(allHealthyRpcs: HealthyRpc[]): {
    validatedRpcs: HealthyRpc[];
    chainIdMismatches: Map<string, string[]>;
  } {
    const validatedRpcs: HealthyRpc[] = [];
    const chainIdMismatches = new Map<string, string[]>(); // expectedChainId -> [returnedWrongId1, returnedWrongId2]
    const rpcsByExpectedChain = new Map<string, HealthyRpc[]>(); // Key: expectedChainId

    allHealthyRpcs.forEach(rpc => {
      if (!rpcsByExpectedChain.has(rpc.chainId)) {
        rpcsByExpectedChain.set(rpc.chainId, []);
      }
      rpcsByExpectedChain.get(rpc.chainId)!.push(rpc);
    });

    this.logger.info(`Validating chain IDs for ${rpcsByExpectedChain.size} chains.`);

    rpcsByExpectedChain.forEach((rpcsInChain, expectedChainId) => {
      const counts = new Map<string, number>(); // returnedChainId -> count
      rpcsInChain.forEach(rpc => {
        counts.set(rpc.returnedChainId, (counts.get(rpc.returnedChainId) || 0) + 1);
      });

      let dominantChainId = expectedChainId; // Assume original is dominant initially
      let maxCount = counts.get(expectedChainId) || 0;

      counts.forEach((count, returnedId) => {
        this.logger.debug(
          `Chain ${expectedChainId}: ${count} endpoints reported chainId ${returnedId}.`,
        );
        if (count > maxCount) {
          maxCount = count;
          dominantChainId = returnedId;
        }
      });

      // If after checking all, the configured one still has a good count, but another is MORE dominant
      if (dominantChainId !== expectedChainId && maxCount > (counts.get(expectedChainId) || 0)) {
        this.logger.warn(
          `Chain ${expectedChainId}: Dominant chainId is ${dominantChainId} (${maxCount} RPCs), which differs from expected. Adding to mismatches.`,
        );
        if (!chainIdMismatches.has(expectedChainId)) chainIdMismatches.set(expectedChainId, []);
        if (!chainIdMismatches.get(expectedChainId)!.includes(dominantChainId)) {
          chainIdMismatches.get(expectedChainId)!.push(dominantChainId);
        }
      } else if (dominantChainId === expectedChainId) {
        this.logger.info(
          `Chain ${expectedChainId}: Dominant chainId ${dominantChainId} matches expected.`,
        );
      }

      rpcsInChain.forEach(rpc => {
        if (rpc.returnedChainId === dominantChainId) {
          validatedRpcs.push(rpc);
        } else {
          this.logger.warn(
            `RPC ${rpc.url} (Expected: ${expectedChainId}) returned ${rpc.returnedChainId}, but dominant for this group is ${dominantChainId}. Excluding.`,
          );
          if (!chainIdMismatches.has(expectedChainId)) chainIdMismatches.set(expectedChainId, []);
          if (!chainIdMismatches.get(expectedChainId)!.includes(rpc.returnedChainId)) {
            chainIdMismatches.get(expectedChainId)!.push(rpc.returnedChainId);
          }
          endpointFailureTracker.logFailure({
            url: rpc.url,
            chainId: rpc.returnedChainId,
            expectedChainId: expectedChainId,
            timestamp: Date.now(),
            stage: "validation",
            reason: `Chain ID mismatch. Expected ${expectedChainId}, got ${rpc.returnedChainId}, dominant is ${dominantChainId}`,
            responseData: {
              returnedChainId: rpc.returnedChainId,
              dominantChainId: dominantChainId,
            },
            responseTime: rpc.responseTime,
            attempts: 1,
          });
        }
      });
    });
    return { validatedRpcs, chainIdMismatches };
  }

  /**
   * @dev Tests a collection of RPC endpoints with specified concurrency.
   * @param endpoints An array of RpcEndpoint configurations.
   * @returns A promise resolving to the RpcTestResult.
   */
  public async testEndpoints(endpoints: RpcEndpoint[]): Promise<RpcTestResult> {
    // Signal to the failure tracker that we're starting a batch of tests
    endpointFailureTracker.startTestBatch();

    const healthyRpcs: HealthyRpc[] = [];
    const endpointQueue = [...endpoints];
    let completedCount = 0;
    const totalEndpoints = endpoints.length;
    const startTime = Date.now();

    this.logger.info(
      `Starting RPC tests for ${totalEndpoints} endpoints. Concurrency: ${this.config.HTTP_REQUEST_CONCURRENCY}.`,
    );

    return new Promise<RpcTestResult>(resolve => {
      const completeTestRun = async (isIncomplete: boolean = false) => {
        this.cleanupTimers();
        this.logger.info(
          `RPC testing ${isIncomplete ? "timed out or was interrupted" : "completed"}. Tested ${completedCount}/${totalEndpoints} endpoints.`,
        );

        const { validatedRpcs, chainIdMismatches } = this.validateAndFilterRpcs(healthyRpcs);

        this.logger.info(
          `Validation complete: ${validatedRpcs.length} healthy and valid RPCs. ${chainIdMismatches.size} chains had mismatches.`,
        );

        // Signal test batch completion and wait for all logs to be flushed
        await endpointFailureTracker.completeTestBatch();

        // Now that all logs are guaranteed to be written, resolve the promise
        resolve({ healthyRpcs: validatedRpcs, chainIdMismatches, incomplete: isIncomplete });
      };

      // Set up a graceful shutdown handler
      const handleShutdown = async () => {
        this.logger.warn("Received shutdown signal. Ensuring all failure logs are written...");
        await endpointFailureTracker.flushAllLogs();
        this.logger.info("All failure logs flushed. Exiting.");
        process.exit(0);
      };

      // Register handlers for graceful shutdown
      process.once("SIGINT", handleShutdown);
      process.once("SIGTERM", handleShutdown);

      this.logIntervalId = setInterval(async () => {
        await this.logStatus(totalEndpoints, endpointQueue.length, healthyRpcs.length, startTime);
      }, this.config.LOG_INTERVAL_MS);

      const processQueue = () => {
        if (endpointQueue.length === 0 && this.activeTesters.size === 0) {
          completeTestRun(false);
          return;
        }

        while (
          endpointQueue.length > 0 &&
          this.activeTesters.size < this.config.HTTP_REQUEST_CONCURRENCY
        ) {
          const endpointToTest = endpointQueue.shift();
          if (!endpointToTest) continue;

          const tester = new EndpointTester(endpointToTest, this.config, this.logger);
          this.activeTesters.set(endpointToTest.url, tester);

          tester
            .test()
            .then(result => {
              if (result) {
                healthyRpcs.push(result);
              } else {
                // Detailed failure logging is handled within EndpointTester
                // No need to add additional logging here
              }
            })
            .catch(e => {
              // Should not happen if EndpointTester.test() catches its errors
              this.logger.warn(
                `[Framework Error] Unexpected error from EndpointTester for ${endpointToTest.url}: ${e.message}`,
              );

              // Log framework error
              const testerStatus = tester.getStatus();
              endpointFailureTracker.logFailure({
                url: endpointToTest.url,
                chainId: "unknown",
                expectedChainId: endpointToTest.chainId,
                timestamp: Date.now(),
                stage: testerStatus.currentStage,
                reason: "Framework Error",
                errorMessage: e instanceof Error ? e.message : String(e),
                attempts: testerStatus.attempt,
                testDuration: Date.now() - testerStatus.startTime,
              });
            })
            .finally(() => {
              this.activeTesters.delete(endpointToTest.url);
              completedCount++;
              processQueue(); // Attempt to process more from the queue
            });
        }
      };
      processQueue(); // Initial call to start processing
    });
  }
}

export { RpcTester, RpcTesterConfig, Logger };
