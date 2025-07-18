import config from "../constants/config";
import { debug } from "./logger";

export function shouldProcessNetwork(networkType: string): boolean {
  const shouldProcessMainnet = config.NETWORK_MODE === 1 || config.NETWORK_MODE === 2;
  const shouldProcessTestnet = config.NETWORK_MODE === 0 || config.NETWORK_MODE === 2;

  // Default to true if network type is undefined or empty
  if (!networkType) {
    debug(`Network type is undefined or empty, defaulting to process this network`);
    return true;
  }

  const result =
    (networkType === "mainnet" && shouldProcessMainnet) ||
    (networkType === "testnet" && shouldProcessTestnet);

  debug(
    `shouldProcessNetwork: ${networkType}, NETWORK_MODE: ${config.NETWORK_MODE}, result: ${result}`,
  );
  return result;
}
