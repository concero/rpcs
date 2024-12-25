# RPC health checker

A service for upkeeping a list of healthy RPC endpoints for multiple chains.
The results of the healthcheck are regularly pushed to output/healthy-rpcs.json.
The service can be run manually or scheduled to run periodically using a cron job.

## Usage


### Configuration File
```ts
// src/config.ts
export default {
    CHAINLIST_URL: "https://raw.githubusercontent.com/DefiLlama/chainlist/refs/heads/main/constants/extraRpcs.js",
    RPC_REQUEST_TIMEOUT_MS: 10000,
    GIT_REPO_PATH: process.env.GIT_REPO_PATH || ".",
    HEALTHY_RPCS_FILE: "output/healthy-rpcs.json",
    CRON_SCHEDULE: process.env.CRON_SCHEDULE || "0 0 * * *",
    LOG_DIR: "logs",
    LOG_MAX_FILES: "7d",
    CONCURRENCY_LIMIT: parseInt(process.env.CONCURRENCY_LIMIT || "100", 10),
    WHITELISTED_CHAIN_IDS: [1, 137],
    RETRY_DELAY_MS: 12000,
    MAX_RETRIES: 1,
};
```

### Run Once

To run the service once, use the `--run-once` flag:

```sh
npm start --run-once
```

### Run Periodically

To run the service periodically based on the cron schedule, simply start the service without any flags:

```sh
npm start
```
