export default {
    CHAINLIST_URL:
        "https://raw.githubusercontent.com/DefiLlama/chainlist/refs/heads/main/constants/extraRpcs.js",
    RPC_REQUEST_TIMEOUT_MS: 10000,
    GIT_REPO_PATH: process.env.GIT_REPO_PATH || ".",
    HEALTHY_RPCS_FILE: "output/healthy-rpcs.json",
    CRON_SCHEDULE: process.env.CRON_SCHEDULE || "0 0 * * *", // daily midnight
    LOG_DIR: "logs",
    LOG_MAX_FILES: "7d",
    CONCURRENCY_LIMIT: parseInt(process.env.CONCURRENCY_LIMIT || "100", 10),
    WHITELISTED_CHAIN_IDS: [1, 137],
    RETRY_DELAY_MS: 12000,
    MAX_RETRIES: 1,
};
