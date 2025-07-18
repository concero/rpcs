# RPC health checker

A service for upkeeping a list of healthy RPC endpoints for multiple chains.
The results of the healthcheck are regularly pushed to output/mainnet.json and output/testnet.json.
The service can be run manually or scheduled to run periodically using a cron job.

## Architecture

The service follows a modular architecture with clear separation of concerns:

1. **Data Collection**: Fetches RPC endpoints from multiple sources (chainlist, ethereum-lists, v2-networks)
2. **Filtering & Deduplication**: Removes blacklisted domains and deduplicates endpoints based on priority
   - Uses `filterEndpoints` as the primary function
   - Maintains `deduplicateEndpoints` for backward compatibility
3. **Testing**: Tests each endpoint for health and performance metrics
4. **Output Generation**: Generates mainnet.json and testnet.json files with healthy RPC endpoints
5. **Self-Contained Logging**: Each module handles its own logging to maintain clean separation of concerns

### Key Components

- **filterEndpoints**: Core utility that handles both domain blacklist filtering and endpoint deduplication based on source priority
- **rpcTester**: Tests RPC endpoints for health and response time
- **fetchExternalEndpoints**: Collects RPC endpoints from multiple sources

## Usage

### Configuration File
```ts
// src/constants/config.ts
export default {
    // Domain blacklist configuration
    DOMAIN_BLACKLIST: domainBlacklist,
    ENABLE_DOMAIN_BLACKLIST: true,
    
    // RPC tester configuration
    RPC_TESTER: {
        HTTP_REQUEST_CONCURRENCY: 100,
        HTTP_REQUEST_TIMEOUT_MS: 6000,
        RETRY_DELAY_MS: 0,
        MAX_RETRIES: 1,
    },
    
    // Data sources
    CHAINLIST_URL: "https://raw.githubusercontent.com/DefiLlama/chainlist/refs/heads/main/constants/extraRpcs.js",
    ETHEREUM_LISTS_URL_TEMPLATE: "https://raw.githubusercontent.com/ethereum-lists/chains/refs/heads/master/_data/chains/eip155-{chainId}.json",
    
    // Git configuration
    GIT_REPO_PATH: process.env.GIT_REPO_PATH || ".",
    ENABLE_GIT_SERVICE: process.env.ENABLE_GIT_SERVICE === "true" || false,
    
    // General configuration
    CRON_SCHEDULE: process.env.CRON_SCHEDULE || "0 0 * * *",
    OUTPUT_DIR: "output/",
    LOG_DIR: "logs",
    LOG_MAX_FILES: "7d",
};
```

### Run Once

To run the service once, use the `--run-once` flag:

```sh
npm start -- --run-once
```

### Run Periodically

To run the service periodically based on the cron schedule, simply start the service without any flags:

```sh
npm start
```

## Endpoint Filtering Logic

The `filterEndpoints` utility function is the core function that handles three key operations:

1. **Domain Blacklisting**: Filters out RPC endpoints from domains in the blacklist
2. **Priority-based Deduplication**: Removes duplicate endpoints based on source priority:
3. **Statistics Logging**: Handles its own logging of filtering statistics
   - v2-networks endpoints have highest priority
   - chainlist endpoints have medium priority
   - ethereum-lists endpoints have lowest priority

```typescript
// Usage example
import { filterEndpoints } from "./utils/filterEndpoints";

const endpoints = await fetchExternalEndpoints(supportedChainIds, networkDetails);
const { filteredEndpoints, initialCollection } = filterEndpoints(
  endpoints.chainlist,
  endpoints.ethereumLists,
  endpoints.v2Networks,
  endpoints.initialCollection
);
```

For backward compatibility, a helper function `deduplicateEndpoints` is provided that wraps `filterEndpoints`:

```typescript
// Legacy usage
import { deduplicateEndpoints } from "./utils/deduplicateEndpoints";

const endpoints = await fetchExternalEndpoints(supportedChainIds, networkDetails);
const filteredEndpoints = deduplicateEndpoints(endpoints);
```

The filtering function logs statistics about filtered endpoints directly, including total count, number of blacklisted domains, and number of duplicates removed. This keeps the main service flow cleaner and follows better separation of concerns.
