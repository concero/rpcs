export default {
  IGNORE_CHAIN_IDS: [], // Chain IDs to ignore from chainlist
  USE_MAINNET: process.env.USE_MAINNET === "true" || false,
  LOG_LEVEL: process.env.LOG_LEVEL || "info", // "error" | "warn" | "info" | "debug"
  LOG_DIR: "logs",
  LOG_MAX_FILES: "7d",
  CHAINLIST_URL:
    "https://raw.githubusercontent.com/DefiLlama/chainlist/refs/heads/main/constants/extraRpcs.js",
  RPC_REQUEST_TIMEOUT_MS: 10000,
  GIT_REPO_PATH: process.env.GIT_REPO_PATH || ".",
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || "0 0 * * *", // daily midnight
  CONCURRENCY_LIMIT: parseInt(process.env.CONCURRENCY_LIMIT || "100", 10),
  RETRY_DELAY_MS: 12000,
  MAX_RETRIES: 1,
  OUTPUT_DIR: "output/",
};
