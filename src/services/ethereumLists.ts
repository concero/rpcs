import config from "../constants/config";
import { debug, info } from "../utils/logger";
import { EthereumListsChain } from "../types";

export async function fetchEthereumListsChains(
  chainIds: string[],
): Promise<Record<string, EthereumListsChain>> {
  const result: Record<string, EthereumListsChain> = {};

  const fetchChain = async (chainId: string): Promise<EthereumListsChain | null> => {
    try {
      const url = config.URLS.ETHEREUM_LISTS_URL_TEMPLATE.replace("{chainId}", chainId);
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status !== 404) {
          debug(`Failed to fetch chain ${chainId} from ethereum-lists: ${response.status}`);
        }
        return null;
      }

      const chainData = await response.json();
      return chainData as EthereumListsChain;
    } catch (err) {
      debug(`Error fetching chain ${chainId} from ethereum-lists: ${err}`);
      return null;
    }
  };

  const fetchPromises = chainIds
    .filter(id => !config.IGNORED_ETHEREUM_LISTS_CHAIN_IDS.includes(parseInt(id, 10)))
    .map(async chainId => {
      const chain = await fetchChain(chainId);
      if (chain) {
        result[chainId] = chain;
      }
    });

  await Promise.all(fetchPromises);

  info(`Fetched ${Object.keys(result).length} chains from ethereum-lists`);
  return result;
}
