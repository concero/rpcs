import { EthereumListsChain } from "../types";
export declare function fetchChainFromEthereumLists(chainId: string): Promise<EthereumListsChain | null>;
export declare function fetchEthereumListsChains(chainIds: string[]): Promise<Record<string, EthereumListsChain>>;
