export const chainIdToSelector: { [key: string]: number } = {
  "1": 1, // Ethereum
  "10": 10, // Optimism
  "137": 137, // Polygon
  "8453": 8453, // Base
  "42161": 42161, // Arbitrum
  "43114": 43114, // Avalanche
  // Testnets
  "11155111": 11155111, // Ethereum Sepolia
  "421614": 421614, // Arbitrum Sepolia
  "84532": 84532, // Base Sepolia
  "11155420": 11155420, // Optimism Sepolia
  "80002": 80002, // Polygon Amoy
  "43113": 43113, // Avalanche Fuji
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
