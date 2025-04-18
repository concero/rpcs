import config from "../constants/config";

export function shouldProcessNetwork(networkType: string): boolean {
  const shouldProcessMainnet = config.NETWORK_MODE === 1 || config.NETWORK_MODE === 2;
  const shouldProcessTestnet = config.NETWORK_MODE === 0 || config.NETWORK_MODE === 2;

  return (
    (networkType === "mainnet" && shouldProcessMainnet) ||
    (networkType === "testnet" && shouldProcessTestnet)
  );
}
