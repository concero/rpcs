import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import config from "../constants/config";
import { RpcTestStepResult } from "../types";
import * as logger from "../utils/logger";

export interface EndpointFailureDetails {
  url: string;
  chainId: string; // Actual chainId returned by the RPC, may differ from expected
  expectedChainId: string;
  timestamp: number;
  stage: string;
  reason: string;
  responseData?: any;
  errorMessage?: string;
  httpStatus?: number;
  httpStatusText?: string;
  responseTime?: number;
  attempts: number;
  testDuration?: number;
}

interface LogItem {
  details: EndpointFailureDetails;
  formattedData: string;
  filePath: string;
  directoryPath: string;
  retryCount: number;
}

class EndpointFailureTracker {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_MS = 500;
  private static readonly MAX_QUEUE_SIZE = 5000;

  private logItems: LogItem[] = [];
  private baseLogDirInitialized = false;
  private isWriting = false;
  private flushPromise: Promise<void> | null = null;
  private testingActive = false;
  private testCompletedCallback: (() => void) | null = null;

  constructor() {
    this.initBaseLogDirectory();
  }

  /**
   * Initializes base log directory
   */
  private async initBaseLogDirectory(): Promise<void> {
    try {
      const failedRpcBaseDir = join(config.LOG_DIR, "failed-rpcs");
      await mkdir(failedRpcBaseDir, { recursive: true });
      this.baseLogDirInitialized = true;
      logger.info(`RPC failure logs base directory initialized at ${failedRpcBaseDir}`);
    } catch (error) {
      this.baseLogDirInitialized = false;
      logger.error(
        `Failed to initialize RPC failure logs base directory: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Marks the beginning of a test batch
   */
  public startTestBatch(): void {
    this.testingActive = true;
    logger.info("Failure tracker: Test batch started");
  }

  /**
   * Records a failure and queues it for writing
   */
  public async logFailure(details: EndpointFailureDetails): Promise<void> {
    if (!this.baseLogDirInitialized) {
      try {
        await this.initBaseLogDirectory();
      } catch (error) {
        logger.warn(
          `Base log directory init failed for ${details.url}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const timestamp = new Date(details.timestamp);
    const dateStr = timestamp.toISOString().split("T")[0];

    // Format timestamp for unique filename
    const isoTimestampParts = timestamp.toISOString().split("T");
    const timePart = isoTimestampParts[1];
    const timeStrWithoutColons = timePart
      .substring(0, timePart.length - 1)
      .replace(/:/g, "-")
      .replace(/\./, "-"); // HH-MM-SS-mmm

    // Create directory path: logs/failed-rpcs/[date]/[chainId]
    const specificLogDir = join(config.LOG_DIR, "failed-rpcs", dateStr, details.expectedChainId);

    // Sanitize URL for filename
    const sanitizedUrl = details.url
      .replace(/https?:\/\//, "")
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .substring(0, 100);

    const filename = `${timeStrWithoutColons}_${sanitizedUrl}.json`;
    const filePath = join(specificLogDir, filename);

    const logData = {
      url: details.url,
      expectedChainId: details.expectedChainId,
      returnedChainId: details.chainId !== details.expectedChainId ? details.chainId : undefined,
      timestamp: timestamp.toISOString(),
      stage: details.stage,
      reason: details.reason,
      responseData: details.responseData,
      error: details.errorMessage,
      httpStatus: details.httpStatus,
      httpStatusText: details.httpStatusText,
      responseTime: details.responseTime,
      attempts: details.attempts,
      testDuration: details.testDuration,
    };

    try {
      const formattedData = JSON.stringify(logData, null, 2);

      // Check if queue is getting too large and might indicate a problem
      if (this.logItems.length >= EndpointFailureTracker.MAX_QUEUE_SIZE) {
        logger.warn(
          `Failure log queue exceeding ${EndpointFailureTracker.MAX_QUEUE_SIZE} items! Consider if there's an issue with disk writes.`,
        );
      }

      // Add to queue
      this.logItems.push({
        details,
        formattedData,
        filePath,
        directoryPath: specificLogDir,
        retryCount: 0,
      });

      // If we're not actively testing, flush immediately
      if (!this.testingActive) {
        this.triggerFlush();
      }
    } catch (error) {
      logger.warn(
        `Failed to prepare log data for ${details.url}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Called when all tests are complete to ensure logs are flushed
   */
  public async completeTestBatch(): Promise<void> {
    if (!this.testingActive) {
      return; // Not in a test batch
    }

    this.testingActive = false;
    logger.info(
      `Failure tracker: Test batch complete. Flushing ${this.logItems.length} pending logs...`,
    );

    // Flush all log items and wait for completion
    await this.flushAllLogs();

    if (this.testCompletedCallback) {
      this.testCompletedCallback();
      this.testCompletedCallback = null;
    }

    logger.info("Failure tracker: All logs have been flushed to disk");
  }

  /**
   * Waits for all logs to be flushed to disk.
   * Used before app termination to ensure data integrity.
   */
  public async flushAllLogs(): Promise<void> {
    // If already flushing, wait for that to complete
    if (this.flushPromise) {
      await this.flushPromise;
    }

    // If still have items, trigger a new flush and wait
    if (this.logItems.length > 0) {
      this.flushPromise = this.processQueue(true);
      await this.flushPromise;
    }
  }

  /**
   * Wrapper to start queue processing without awaiting
   */
  private triggerFlush(): void {
    if (!this.isWriting && this.logItems.length > 0) {
      this.flushPromise = this.processQueue();

      // Catch any unhandled errors to avoid unhandled promise rejections
      this.flushPromise.catch(error => {
        logger.error(`Unexpected error during log flushing: ${error}`);
      });
    }
  }

  /**
   * Processes the queue of log writes
   * @param flushAll When true, processes the entire queue before returning
   */
  private async processQueue(flushAll = false): Promise<void> {
    if (this.isWriting) {
      return; // Another process is already writing
    }

    this.isWriting = true;
    let successCount = 0;
    let failCount = 0;

    try {
      // Continue processing until queue is empty or we've processed the current batch (if not flushAll)
      const initialQueueSize = this.logItems.length;
      let processedCount = 0;

      while (this.logItems.length > 0 && (flushAll || processedCount < initialQueueSize)) {
        const item = this.logItems.shift();
        if (!item) break;

        processedCount++;

        try {
          // Ensure directory exists
          await mkdir(item.directoryPath, { recursive: true });

          // Write file - this is the critical operation that must complete
          await writeFile(item.filePath, item.formattedData, "utf8");
          successCount++;

          // Log at debug level for successful writes
          logger.debug(`Logged RPC failure for ${item.details.url} to ${item.filePath}`);
        } catch (error) {
          failCount++;

          // Retry logic for failed writes
          if (item.retryCount < EndpointFailureTracker.MAX_RETRIES) {
            item.retryCount++;
            logger.warn(
              `Failed to write log for ${item.details.url}. Retry ${item.retryCount}/${EndpointFailureTracker.MAX_RETRIES}. Error: ${error instanceof Error ? error.message : String(error)}`,
            );

            // Add back to beginning of queue for faster retry
            this.logItems.unshift(item);

            // Add a small delay before retrying
            await new Promise(resolve =>
              setTimeout(resolve, EndpointFailureTracker.RETRY_DELAY_MS),
            );
          } else {
            logger.error(
              `Failed to write RPC failure log for ${item.details.url} after ${EndpointFailureTracker.MAX_RETRIES} retries: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
    } finally {
      // Always ensure isWriting is reset, even if an error occurs
      this.isWriting = false;

      // If we still have items in the queue, trigger another processing round
      if (this.logItems.length > 0) {
        setImmediate(() => this.triggerFlush());
      }

      if (successCount > 0 || failCount > 0) {
        logger.info(
          `Log flush complete: ${successCount} logs written successfully, ${failCount} failed, ${this.logItems.length} pending`,
        );
      }
    }
  }

  /**
   * Creates a failure record from an RPC test result
   */
  public recordFailureFromResponse(
    url: string,
    expectedChainId: string,
    stage: string,
    result: RpcTestStepResult,
    attempts: number,
    testDuration?: number,
  ): EndpointFailureDetails {
    const reason = this.determineFailureReason(result);

    const details: EndpointFailureDetails = {
      url,
      chainId: result.chainId || "unknown",
      expectedChainId,
      timestamp: Date.now(),
      stage,
      reason,
      responseData: result.jsonResult,
      errorMessage: result.error,
      httpStatus: result.httpStatus,
      httpStatusText: result.httpStatusText,
      responseTime: result.responseTime,
      attempts,
      testDuration,
    };

    // Queue for writing but don't await
    this.logFailure(details).catch(err => {
      logger.warn(
        `Error queueing failure log for ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    return details;
  }

  /**
   * Determines the failure reason from the test result
   */
  private determineFailureReason(result: RpcTestStepResult): string {
    if (result.rateLimited) {
      return "Rate Limited";
    }
    if (result.isTimeout) {
      return "Request Timeout";
    }
    // Prioritize HTTP status codes that indicate errors
    if (result.httpStatus && result.httpStatus >= 400) {
      return `HTTP Error ${result.httpStatus}${result.httpStatusText ? ` ${result.httpStatusText}` : ""}`;
    }
    // Check for errors in the JSON RPC response or general client errors
    if (result.error) {
      if (result.jsonResult && typeof result.jsonResult === "object" && result.jsonResult.error) {
        const rpcError = result.jsonResult.error as { message?: string; code?: number };
        return `RPC Error: ${rpcError.message || result.error} (Code: ${rpcError.code || "N/A"})`;
      }
      return `Client Error: ${result.error}`;
    }
    // Handle other non-successful HTTP statuses if they weren't caught above
    if (result.httpStatus && (result.httpStatus < 200 || result.httpStatus >= 300)) {
      return `Unexpected HTTP Status ${result.httpStatus}${result.httpStatusText ? ` ${result.httpStatusText}` : ""}`;
    }
    return "Unknown Failure";
  }

  /**
   * Register a callback for when all logs have been flushed after test completion
   */
  public onAllLogsWritten(callback: () => void): void {
    this.testCompletedCallback = callback;
  }
}

// Singleton instance
export const endpointFailureTracker = new EndpointFailureTracker();
