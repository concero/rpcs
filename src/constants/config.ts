export default {
  IGNORED_CHAINLIST_CHAIN_IDS: [
    200810, // bitlayer
    6342, // megaeth
    3636, // botanix
    2021, // roninSaigon
    1114, // btcs-testnet
    919, // mode-sepolia
    157, // puppynet
    81, // astar-shibuya
    44787, // celo
    168587773,
  ],
  IGNORED_ETHEREUM_LISTS_CHAIN_IDS: [
    2021, // roninSaigon
    81, // astar-shibuya
    44787, // celo
    168587773,
  ],

  NETWORK_MODE: parseInt(process.env.NETWORK_MODE || "2", 10), // 0-testnet, 1-mainnet, 2-both

  // logging
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  LOG_DIR: "logs",
  LOG_MAX_FILES: "7d",

  RPC_TESTER: {
    HTTP_REQUEST_CONCURRENCY: 100,
    HTTP_REQUEST_TIMEOUT_MS: 6 * 1000,
    RETRY_DELAY_MS: 0,
    MAX_RETRIES: 1,
  },

  // urls
  CHAINLIST_URL:
    "https://raw.githubusercontent.com/DefiLlama/chainlist/refs/heads/main/constants/extraRpcs.js",
  ETHEREUM_LISTS_URL_TEMPLATE:
    "https://raw.githubusercontent.com/ethereum-lists/chains/refs/heads/master/_data/chains/eip155-{chainId}.json",
  CONCERO_NETWORKS_GITHUB_BASE_URL:
    "https://raw.githubusercontent.com/concero/v2-networks/refs/heads/master/networks",
  CONCERO_NETWORKS_DATA_URL_TEMPLATE: "${CONCERO_NETWORKS_GITHUB_BASE_URL}/${networkType}.json",
  CONCERO_NETWORK_DETAILS_URL_TEMPLATE:
    "${CONCERO_NETWORKS_GITHUB_BASE_URL}/${networkType}/${networkName}.json",

  GIT_REPO_PATH: process.env.GIT_REPO_PATH || ".",
  ENABLE_GIT_SERVICE: process.env.ENABLE_GIT_SERVICE === "true" || false,

  OUTPUT_DIR: "output/",
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || "0 0 * * *",
};
