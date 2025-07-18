import { domainBlacklist } from "./domainBlacklist";

export default {
  NETWORK_MODE: parseInt(process.env.NETWORK_MODE || "2", 10), // 0-testnet, 1-mainnet, 2-both

  DOMAIN_BLACKLIST: domainBlacklist,
  ENABLE_DOMAIN_BLACKLIST: true,
  IGNORED_CHAINLIST_CHAIN_IDS: [
    200810, // bitlayer
    6342, // megaeth
    3636, // botanix
    2021, // roninSaigon
    1114, // btcs-testnet
    919, // mode-sepolia
    157, // puppynet
    81, // astar-shibuya
  ],
  IGNORED_ETHEREUM_LISTS_CHAIN_IDS: [
    2021, // roninSaigon
    81, // astar-shibuya
  ],

  LOGGER: {
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    LOG_DIR: "logs",
    LOG_MAX_FILES: "7d",
  },

  RPC_TESTER: {
    HTTP_REQUEST_CONCURRENCY: 50,
    HTTP_REQUEST_TIMEOUT_MS: 1000 * 5,
    RETRY_DELAY_MS: 0,
    MAX_RETRIES: 3,
  },

  URLS: {
    CHAINLIST_RPCS_URL: "https://chainlist.org/rpcs.json",
    CHAINLIST_EXTRA_RPCS_URL:
      "https://raw.githubusercontent.com/DefiLlama/chainlist/refs/heads/main/constants/extraRpcs.js",
    ETHEREUM_LISTS_URL_TEMPLATE:
      "https://raw.githubusercontent.com/ethereum-lists/chains/refs/heads/master/_data/chains/eip155-{chainId}.json",
    CONCERO_NETWORKS_GITHUB_BASE_URL:
      "https://raw.githubusercontent.com/concero/v2-networks/refs/heads/feature/single-file/networks",
  },

  GIT: {
    ENABLE_GIT_SERVICE: process.env.ENABLE_GIT_SERVICE === "true" || false,
    REPO_PATH: process.env.GIT_REPO_PATH || ".",
  },

  OUTPUT_DIR: "output/",
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || "0 0 * * *",
};
