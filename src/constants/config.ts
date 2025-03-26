export default {
  WHITELISTED_CHAIN_IDS: [
    1, 10, 137, 8453, 42161, 43114, 11155111, 11155420, 80002, 84532, 421614, 43113,
  ],
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
