export const chainIdToSelector: { [key: string]: number } = {
  "1": 1, // Ethereum
  "10": 10, // Optimism
  "137": 137, // Polygon
  "8453": 8453, // Base
  "42161": 42161, // Arbitrum
  "43114": 43114, // Avalanche
  // Testnets
  "421613": 42162, // Arbitrum Sepolia
  "84531": 8454, // Base Sepolia
  "11155420": 11, // Optimism Sepolia
  "5000": 138, // Polygon Amoy
};

export const selectorToChainId: { [key: number]: string } = Object.entries(
  chainIdToSelector,
).reduce((acc: { [key: number]: string }, [chainId, selector]) => {
  acc[selector] = chainId;
  return acc;
}, {});

export function getChainSelector(chainId: string): number | undefined {
  return chainIdToSelector[chainId];
}

export function getChainId(selector: number): string | undefined {
  return selectorToChainId[selector];
}
