# RPC Health Checker Service

A high-performance service for maintaining a curated list of healthy RPC endpoints across multiple blockchain networks. The service automatically discovers, tests, and validates RPC endpoints from various sources, then outputs sorted lists of healthy endpoints for both mainnet and testnet networks.

## Features

- **Multi-source RPC Discovery**: Aggregates endpoints from Chainlist, Ethereum Lists, and Concero Networks
- **Health Testing**: Validates RPC endpoints with configurable retry logic and timeout handling
- **Performance Metrics**: Sorts endpoints by response time for optimal selection
- **Chain ID Validation**: Ensures RPCs return the expected chain ID to prevent misconfigurations
- **Override Support**: Allows manual addition of trusted RPC endpoints
- **Automated Git Integration**: Optionally commits and pushes results to a Git repository
- **Flexible Scheduling**: Run once or on a cron schedule
- **Docker Support**: Containerized deployment with volume mounts

## Architecture

### Data Flow

```
1. Network Configuration (Concero Networks)
           ↓
2. RPC Discovery (3 sources)
   - Chainlist API
   - Ethereum Lists
   - Concero Networks
           ↓
3. Filtering & Deduplication
   - Domain blacklist filtering
   - Priority-based deduplication
           ↓
4. Health Testing
   - Chain ID verification
   - Response time measurement
   - Retry logic for transient failures
           ↓
5. Override Application
   - Merge manual overrides
           ↓
6. Output Generation
   - mainnet.json
   - testnet.json
           ↓
7. Optional Git Push
```

### Project Structure

```
rpcs/
├── src/
│   ├── index.ts              # Entry point with CLI handling
│   ├── main.ts               # Main orchestration logic
│   ├── types.ts              # TypeScript interfaces
│   ├── constants/
│   │   ├── config.ts         # Configuration settings
│   │   └── domainBlacklist.ts # Blacklisted domains
│   ├── services/
│   │   ├── rpcTester.ts      # RPC health testing
│   │   ├── conceroNetworks.ts # Fetch network configurations
│   │   ├── chainlistRpcs.ts  # Chainlist integration
│   │   ├── ethereumLists.ts  # Ethereum Lists integration
│   │   ├── fileService.ts    # Output file generation
│   │   ├── gitService.ts     # Git operations
│   │   └── overrideService.ts # Manual override handling
│   └── utils/
│       ├── filterEndpoints.ts # Deduplication & filtering
│       ├── fetchExternalEndpoints.ts # Aggregate all sources
│       ├── processTestResults.ts # Process test outcomes
│       ├── StatsCollector.ts # Statistics tracking
│       └── logger.ts         # Winston logger setup
├── output/                   # Generated JSON files
├── overrides/                # Manual RPC overrides
├── logs/                     # Application logs
└── examples/                 # Example configurations
```

## Installation

### Prerequisites

- Node.js 18+ or Bun runtime
- Git (if using Git integration)
- Docker (for containerized deployment)

### Local Setup

```bash
# Clone the repository
git clone https://github.com/concero/rpcs.git
cd rpcs

# Install dependencies
npm install
# or with Bun
bun install

# Create output directory
mkdir -p output

# (Optional) Set up environment variables
cp .env.example .env
```

## Usage

### Run Once

Execute a single health check cycle:

```bash
npm start -- --run-once
# or with Bun
bun run start
```

### Scheduled Runs

Run continuously with cron scheduling:

```bash
# Remove --run-once flag to use cron schedule
node src/index.ts
```

### Docker Deployment

```bash
# Build the image
docker build -t rpc-health-checker .

# Run with volume mounts
docker run -v $(pwd)/output:/data/output \
           -v $(pwd)/overrides:/data/input \
           -e ENABLE_GIT_SERVICE=false \
           rpc-health-checker
```

## Configuration

### Main Configuration (`src/constants/config.ts`)

```typescript
{
  // Network mode: 0=testnet only, 1=mainnet only, 2=both
  NETWORK_MODE: 2,
  
  // Domain filtering
  DOMAIN_BLACKLIST: [...],
  ENABLE_DOMAIN_BLACKLIST: true,
  
  // RPC testing parameters
  RPC_TESTER: {
    HTTP_REQUEST_CONCURRENCY: 50,    // Parallel requests
    HTTP_REQUEST_TIMEOUT_MS: 5000,   // Request timeout
    RETRY_DELAY_MS: 150,             // Delay between retries
    MAX_RETRIES: 3                   // Maximum retry attempts
  },
  
  // Git integration
  GIT: {
    ENABLE_GIT_SERVICE: false,       // Enable auto-commit
    REPO_PATH: ".",                  // Repository path
    BRANCH: "main",                  // Target branch
    COMMIT_MESSAGE: "Update RPCs"    // Commit message
  },
  
  // Scheduling
  CRON_SCHEDULE: "0 0 * * *"        // Daily at midnight
}
```

### Environment Variables

```bash
# Network selection
NETWORK_MODE=2              # 0=testnet, 1=mainnet, 2=both

# Git integration
ENABLE_GIT_SERVICE=true
GIT_REPO_PATH=/path/to/repo
GIT_BRANCH=main
GIT_AUTHOR_NAME="RPC Bot"
GIT_AUTHOR_EMAIL="bot@example.com"

# Logging
LOG_LEVEL=info             # debug, info, warn, error

# Scheduling
CRON_SCHEDULE="0 */6 * * *" # Every 6 hours
```

## Data Sources

### 1. Concero Networks
Primary source for network configuration and RPC endpoints. Provides chain IDs, selectors, and curated RPC lists.

### 2. Chainlist
Community-maintained list of RPC endpoints. Two sources:
- Main API: `https://chainlist.org/rpcs.json`
- Extra RPCs: GitHub raw content

### 3. Ethereum Lists
Official chain registry with verified RPC endpoints for EVM networks.

## RPC Override System

The service supports manual RPC overrides for adding trusted endpoints that should always be included:

### Override File Format

Create `overrides/mainnet.json` or `overrides/testnet.json`:

```json
{
  "ethereum": {
    "rpcUrls": [
      "https://eth-mainnet.g.alchemy.com/v2/your-api-key",
      "https://mainnet.infura.io/v3/your-api-key"
    ],
    "chainSelector": 1,
    "chainId": "1"
  },
  "polygon": {
    "rpcUrls": [
      "https://polygon-rpc.com"
    ],
    "chainSelector": 137,
    "chainId": "137"
  }
}
```

Override RPCs are:
- Always included in the output (if network exists)
- Placed at the beginning of the RPC list
- Not subject to health testing failures

## Output Format

The service generates two files in the `output/` directory:

### mainnet.json / testnet.json

```json
{
  "ethereum": {
    "id": "1",
    "name": "Ethereum Mainnet",
    "urls": [
      "https://eth.llamarpc.com",
      "https://ethereum.publicnode.com",
      "https://rpc.ankr.com/eth"
    ],
    "chainSelector": 1
  },
  "polygon": {
    "id": "137",
    "name": "Polygon",
    "urls": [
      "https://polygon-rpc.com",
      "https://rpc.ankr.com/polygon"
    ],
    "chainSelector": 137
  }
}
```

URLs are sorted by response time (fastest first).

## Development

### Running Tests

```bash
# Type checking
npm run build

# Linting
npm run lint

# Format code
npm run format
```

### Adding a New RPC Source

1. Create a new service in `src/services/`
2. Implement the data fetching logic
3. Update `fetchExternalEndpoints` to include your source
4. Add source type to `RpcEndpoint` interface

### Debugging

Enable debug logging:

```bash
LOG_LEVEL=debug npm start -- --run-once
```

Check logs in the `logs/` directory for detailed execution traces.

## API Reference

### Key Types

```typescript
interface RpcEndpoint {
  chainId: string;
  url: string;
  source: "chainlist" | "ethereum-lists" | "v2-networks";
}

interface HealthyRpc extends RpcEndpoint {
  responseTime: number;
  returnedChainId: string;
  lastBlockNumber: number;
}

interface NetworkDetails {
  name: string;
  chainId: number;
  chainSelector: number;
  rpcs: string[];
  networkType: "mainnet" | "testnet";
}
```

### Main Functions

- `main()`: Orchestrates the entire RPC health check process
- `testRpcEndpoints()`: Tests endpoints with concurrency control
- `filterEndpoints()`: Deduplicates and filters endpoints
- `processTestResults()`: Groups results by network

## Monitoring & Maintenance

### Statistics

The service logs comprehensive statistics after each run:

- Total endpoints discovered per source
- Healthy vs unhealthy endpoint counts
- Response time distributions
- Chain ID mismatch warnings

### Log Rotation

Logs are automatically rotated:
- Daily rotation
- 7-day retention (configurable)
- Located in `logs/` directory

### Common Issues

1. **High failure rate**: Check domain blacklist and timeout settings
2. **Missing networks**: Verify Concero Networks data source
3. **Slow performance**: Adjust concurrency and timeout values
4. **Git push failures**: Check repository permissions and branch protection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with appropriate tests
4. Ensure code passes linting and type checks
5. Submit a pull request

## License

MIT License - see LICENSE file for details