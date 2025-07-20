# Refactoring Examples

## 1. Simplifying Endpoint Collection

### Current Implementation
```typescript
// Current: Complex nested structure
export type EndpointCollection = {
  chainlist: Map<string, RpcEndpoint[]>;
  ethereumLists: Map<string, RpcEndpoint[]>;
  v2Networks: Map<string, RpcEndpoint[]>;
};

// utils/createEndpointCollection.ts
export function createEndpointCollection(
  chainlistEndpoints: RpcEndpoint[],
  ethereumListsEndpoints: RpcEndpoint[],
  networkEndpoints: RpcEndpoint[],
): EndpointCollection {
  const initialEndpoints: EndpointCollection = {
    chainlist: new Map<string, RpcEndpoint[]>(),
    ethereumLists: new Map<string, RpcEndpoint[]>(),
    v2Networks: new Map<string, RpcEndpoint[]>(),
  };
  // Complex grouping logic...
}
```

### Refactored Implementation
```typescript
// Simplified: Just use array of endpoints
export interface RpcEndpoint {
  chainId: string;
  url: string;
  source: "chainlist" | "ethereum-lists" | "v2-networks";
}

// No need for createEndpointCollection - just concat arrays
export function mergeEndpoints(
  ...endpointArrays: RpcEndpoint[][]
): RpcEndpoint[] {
  return endpointArrays.flat();
}
```

## 2. Consolidating Extraction Functions

### Current Implementation
```typescript
// Three separate functions doing similar things
export function extractChainlistEndpoints(chainlistRpcs: ChainlistRpcs): RpcEndpoint[] {
  return Object.entries(chainlistRpcs).flatMap(([chainId, { rpcs }]) =>
    rpcs.map(rpc => ({
      chainId,
      url: rpc,
      source: "chainlist" as const,
    })),
  );
}

export function extractEthereumListsEndpoints(
  ethereumListsChains: Record<string, any>,
): RpcEndpoint[] {
  return Object.entries(ethereumListsChains).flatMap(([chainId, chain]) =>
    chain.rpc
      .filter(url => url.startsWith("http"))
      .map(url => ({
        chainId,
        url,
        source: "ethereum-lists" as const,
      })),
  );
}

export function extractNetworkEndpoints(
  networkDetails: Record<string, NetworkDetails>,
): RpcEndpoint[] {
  return Object.entries(networkDetails)
    .filter(([_, details]) => details.rpcs && details.rpcs.length > 0)
    .flatMap(([chainId, details]) =>
      details.rpcs
        .filter(url => url && url.startsWith("http"))
        .map(url => ({
          chainId,
          url,
          source: "v2-networks" as const,
        })),
    );
}
```

### Refactored Implementation
```typescript
// Single generic extraction function
type EndpointExtractor<T> = (data: T) => Array<{ chainId: string; urls: string[] }>;

export function extractEndpoints<T>(
  data: T,
  source: RpcEndpoint['source'],
  extractor: EndpointExtractor<T>
): RpcEndpoint[] {
  return extractor(data).flatMap(({ chainId, urls }) =>
    urls
      .filter(url => url && url.startsWith("http"))
      .map(url => ({ chainId, url, source }))
  );
}

// Usage:
const chainlistEndpoints = extractEndpoints(
  chainlistRpcs,
  "chainlist",
  (data) => Object.entries(data).map(([chainId, { rpcs }]) => ({ chainId, urls: rpcs }))
);

const ethereumEndpoints = extractEndpoints(
  ethereumListsChains,
  "ethereum-lists",
  (data) => Object.entries(data).map(([chainId, chain]) => ({ chainId, urls: chain.rpc }))
);
```

## 3. Simplifying Filter and Deduplication

### Current Implementation
```typescript
export function filterEndpoints(endpoints: EndpointCollection): RpcEndpoint[] {
  const urlMap = new Map<string, RpcEndpoint>();
  const stats = { /* complex stats */ };

  const processEndpoints = (
    source: "chainlist" | "ethereumLists" | "v2-networks",
    endpointMap: Map<string, RpcEndpoint[]>,
  ) => {
    // Complex nested processing
  };

  processEndpoints("chainlist", endpoints.chainlist);
  processEndpoints("ethereumLists", endpoints.ethereumLists);
  processEndpoints("v2-networks", endpoints.v2Networks);
  
  return Array.from(urlMap.values());
}
```

### Refactored Implementation
```typescript
// Composable filter functions
const sanitizeEndpoints = (endpoints: RpcEndpoint[]): RpcEndpoint[] =>
  endpoints.map(endpoint => ({
    ...endpoint,
    url: sanitizeUrl(endpoint.url)
  }));

const filterBlacklisted = (endpoints: RpcEndpoint[]): RpcEndpoint[] =>
  config.ENABLE_DOMAIN_BLACKLIST
    ? endpoints.filter(endpoint => !isDomainBlacklisted(endpoint.url))
    : endpoints;

const deduplicateByUrl = (endpoints: RpcEndpoint[]): RpcEndpoint[] => {
  const seen = new Set<string>();
  return endpoints.filter(endpoint => {
    if (seen.has(endpoint.url)) return false;
    seen.add(endpoint.url);
    return true;
  });
};

// Compose them
export function filterEndpoints(endpoints: RpcEndpoint[]): RpcEndpoint[] {
  return deduplicateByUrl(
    filterBlacklisted(
      sanitizeEndpoints(endpoints)
    )
  );
}
```

## 4. Simplifying Test Result Processing

### Current Implementation
```typescript
export function processTestResults(
  testResult: { healthyRpcs: HealthyRpc[]; chainIdMismatches: Map<string, string[]> },
  networkDetails: Record<string, NetworkDetails>,
  initialEndpoints: EndpointCollection,
): TestResultsCollection {
  // Complex chain ID to network name mapping
  const chainIdToNetworkName = new Map<string, string>();
  Object.entries(networkDetails).forEach(([networkName, details]) => {
    const chainIdStr = details.chainId.toString();
    chainIdToNetworkName.set(chainIdStr, networkName);
    chainIdToNetworkName.set(networkName, networkName);
  });
  
  // Complex processing with reverse lookups
  // ...
}
```

### Refactored Implementation
```typescript
export function processTestResults(
  healthyRpcs: Map<string, HealthyRpc[]>,
  networkDetails: Record<string, NetworkDetails>
): Map<string, HealthyRpc[]> {
  const results = new Map<string, HealthyRpc[]>();
  
  // Simple, direct processing
  healthyRpcs.forEach((rpcs, chainId) => {
    // Find network by chainId
    const network = Object.values(networkDetails)
      .find(n => n.chainId.toString() === chainId);
    
    if (network && shouldProcessNetwork(network.networkType)) {
      // Sort by response time
      const sortedRpcs = [...rpcs].sort((a, b) => a.responseTime - b.responseTime);
      results.set(chainId, sortedRpcs);
    }
  });
  
  return results;
}
```

## 5. Simplified Main Function

### Current Implementation
```typescript
export async function main(): Promise<Map<string, HealthyRpc[]>> {
  const conceroNetworks = await fetchConceroNetworks();
  const supportedChainIds = getSupportedChainIds(conceroNetworks);
  const endpoints = await fetchExternalEndpoints(supportedChainIds, conceroNetworks);
  const filteredEndpoints = filterEndpoints(endpoints);
  const testResult = await testRpcEndpoints(filteredEndpoints);
  const results = processTestResults(testResult, conceroNetworks, endpoints);
  const modifiedFiles = writeChainRpcFiles(results.healthyRpcs, config.OUTPUT_DIR, conceroNetworks);
  displayStats(results);
  
  if (shouldCommitChanges(modifiedFiles)) {
    await commitAndPushChanges(config.GIT.REPO_PATH, modifiedFiles);
  }
  
  return results.healthyRpcs;
}
```

### Refactored Implementation
```typescript
export async function main(): Promise<Map<string, HealthyRpc[]>> {
  // 1. Fetch configuration
  const networks = await fetchConceroNetworks();
  const chainIds = Object.values(networks).map(n => n.chainId.toString());
  
  // 2. Fetch and merge all endpoints
  const endpoints = await Promise.all([
    fetchChainlistEndpoints(chainIds),
    fetchEthereumListsEndpoints(chainIds),
    extractNetworkEndpoints(networks)
  ]).then(arrays => arrays.flat());
  
  // 3. Filter and test
  const filtered = filterEndpoints(endpoints);
  const healthy = await testRpcEndpoints(filtered);
  
  // 4. Process and output
  const results = processResults(healthy, networks);
  const files = writeOutputFiles(results, networks);
  
  // 5. Optional commit
  if (config.GIT.ENABLE_GIT_SERVICE && files.length > 0) {
    await commitChanges(files);
  }
  
  return results;
}
```

## 6. Simplified Statistics

### Current Implementation
```typescript
// Multiple files and complex state tracking
export function displayStats(results: TestResultsCollection): void {
  const mainnetStats: ChainStats[] = [];
  const testnetStats: ChainStats[] = [];
  const processedChainIds = new Set<string>();
  
  results.healthyRpcs.forEach((rpcs, chainId) => {
    // Complex stats calculation
  });
  
  addMissingNetworksToStats(
    results.networkDetails,
    processedChainIds,
    results.initialEndpoints,
    mainnetStats,
    testnetStats,
  );
  
  displayNetworkStats(mainnetStats, testnetStats);
}
```

### Refactored Implementation
```typescript
class RpcStats {
  private readonly stats = new Map<string, {
    healthy: number;
    unhealthy: number;
    bySource: Record<string, number>;
  }>();
  
  recordHealthy(chainId: string, source: string): void {
    const stat = this.getOrCreate(chainId);
    stat.healthy++;
    stat.bySource[source] = (stat.bySource[source] || 0) + 1;
  }
  
  recordUnhealthy(chainId: string): void {
    const stat = this.getOrCreate(chainId);
    stat.unhealthy++;
  }
  
  display(networks: Record<string, NetworkDetails>): void {
    const mainnet: string[] = [];
    const testnet: string[] = [];
    
    this.stats.forEach((stat, chainId) => {
      const network = networks[chainId];
      if (!network) return;
      
      const line = `${network.name}: ${stat.healthy} healthy, ${stat.unhealthy} unhealthy`;
      
      if (network.networkType === 'mainnet') {
        mainnet.push(line);
      } else {
        testnet.push(line);
      }
    });
    
    console.log('=== Mainnet ===');
    mainnet.forEach(line => console.log(line));
    console.log('\n=== Testnet ===');
    testnet.forEach(line => console.log(line));
  }
}
```

## Summary

These refactoring examples demonstrate how to:

1. **Reduce data structure complexity** by using simpler types
2. **Eliminate redundant transformations** through direct data flow
3. **Consolidate duplicate logic** into reusable functions
4. **Simplify complex mappings** by using consistent identifiers
5. **Create composable functions** for better modularity
6. **Remove unnecessary abstractions** that add complexity without value

The refactored code is more maintainable, easier to test, and has a clearer data flow while preserving all functionality.