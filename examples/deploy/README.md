# Kora RPC Node Deployment Guide

This guide will help you deploy your own Kora RPC node to sponsor user transactions. Kora enables gasless transactions where users pay fees in SPL tokens instead of SOL.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Configuration](#configuration)
3. [Deployment Options](#deployment-options)
   - [Local Development](#local-development)
   - [Docker Deployment](#docker-deployment)
   - [Railway Deployment](#railway-deployment)
   - [Fly.io Deployment](#flyio-deployment)
   - [Production Deployment](#production-deployment)
4. [Post-Deployment](#post-deployment)
5. [Monitoring](#monitoring)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying Kora, you need:

1. **Solana Keypair**: A funded keypair that will act as the fee payer
   - Generate a new keypair: `solana-keygen new -o keypair.json`
   - Fund it with SOL for transaction fees
   - For mainnet, ensure you have enough SOL for sustained operations

2. **RPC Endpoint**: Access to a Solana RPC node
   - Local: `http://127.0.0.1:8899` (with `solana-test-validator`)
   - Devnet: `https://api.devnet.solana.com`
   - Mainnet: Use a reliable RPC provider (Helius, QuickNode, etc.)

3. **Token Mint Addresses**: The SPL tokens you want to accept as payment
   - USDC Mainnet: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
   - USDC Devnet: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

## Configuration

### 1. Configure `kora.toml`

The `kora.toml` file controls your node's behavior. Copy the example:

```bash
cp kora.toml kora.production.toml
```

Key configurations to customize:

```toml
[kora]
rate_limit = 100  # Requests per second

# Optional: Authentication (recommended for production)
[kora.auth]
api_key = "your-secure-api-key-here"
hmac_secret = "your-hmac-secret-here"

# Optional: Payment address (where you receive tokens)
# If not set, defaults to your fee payer address
# payment_address = "YourPaymentAddressPubkey11111111111111111111"

[validation]
price_source = "Jupiter"  # Use "Jupiter" for real prices, "Mock" for testing
max_allowed_lamports = 10000000  # Max transaction value (10M = 0.01 SOL)

# Tokens you accept as payment
allowed_tokens = [
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", # USDC
    # Add more token mints here
]

# Programs users can interact with
allowed_programs = [
    "11111111111111111111111111111111",              # System Program
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",   # Token Program
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",  # Associated Token Program
    # Add more programs as needed (DEXes, NFT marketplaces, etc.)
]
```

### 2. Configure `signers.toml`

The `signers.toml` file specifies your fee payer keypair. Multiple signer types are supported:

#### Option A: Local Keypair (Recommended for Development)

```toml
[signer_pool]
strategy = "round_robin"

[[signers]]
name = "main_signer"
type = "memory"
private_key_env = "KORA_PRIVATE_KEY"
weight = 1
```

Then set the environment variable:
```bash
export KORA_PRIVATE_KEY="$(cat /path/to/keypair.json)"
```

#### Option B: HashiCorp Vault (Recommended for Production)

```toml
[[signers]]
name = "vault_signer"
type = "vault"
vault_url = "https://vault.example.com"
vault_token_env = "VAULT_TOKEN"
vault_path = "secret/data/kora/signer"
weight = 1
```

#### Option C: Turnkey (Enterprise)

```toml
[[signers]]
name = "turnkey_signer"
type = "turnkey"
organization_id_env = "TURNKEY_ORGANIZATION_ID"
api_public_key_env = "TURNKEY_API_PUBLIC_KEY"
api_private_key_env = "TURNKEY_API_PRIVATE_KEY"
private_key_id_env = "TURNKEY_PRIVATE_KEY_ID"
weight = 1
```

### 3. Environment Variables

Create a `.env` file (see `.env.example`):

```bash
# Required: Your fee payer private key
KORA_PRIVATE_KEY="[123,45,67,...]"  # Array format or base58

# Required: Solana RPC endpoint
RPC_URL="https://api.mainnet-beta.solana.com"

# Optional: Authentication
API_KEY="your-api-key"
HMAC_SECRET="your-hmac-secret"

# Optional: Port configuration
PORT=8080

# Optional: Redis for caching (production recommended)
REDIS_URL="redis://redis:6379"
```

## Deployment Options

### Local Development

Perfect for testing and development:

```bash
# Install Kora CLI
cargo install kora-cli

# Start local Solana validator (optional)
solana-test-validator

# Set environment variables
export KORA_PRIVATE_KEY="$(cat keypair.json)"
export RPC_URL="http://127.0.0.1:8899"

# Initialize token accounts (if using payment address)
kora --config kora.toml --rpc-url $RPC_URL rpc initialize-atas --signers-config signers.toml

# Start the RPC server
kora --config kora.toml --rpc-url $RPC_URL rpc start --signers-config signers.toml --port 8080
```

Test the server:
```bash
curl http://localhost:8080/liveness
# Should return: {"status":"ok"}
```

### Docker Deployment

Deploy using Docker for production or cloud environments:

#### Quick Start with Docker Compose

```bash
# Copy configuration files
cp kora.toml docker-kora.toml
cp signers.toml docker-signers.toml
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start the services
docker-compose up -d

# View logs
docker-compose logs -f kora

# Stop the services
docker-compose down
```

#### Manual Docker Build

```bash
# Build the image
docker build -f Dockerfile -t kora-rpc:latest .

# Run the container
docker run -d \
  --name kora-rpc \
  -p 8080:8080 \
  -e KORA_PRIVATE_KEY="$KORA_PRIVATE_KEY" \
  -e RPC_URL="https://api.mainnet-beta.solana.com" \
  -v $(pwd)/kora.toml:/kora.toml \
  -v $(pwd)/signers.toml:/signers.toml \
  kora-rpc:latest
```

### Railway Deployment

Railway provides one-click cloud deployment:

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

#### Manual Railway Setup

1. **Install Railway CLI**:
   ```bash
   npm i -g @railway/cli
   railway login
   ```

2. **Initialize Project**:
   ```bash
   railway init
   ```

3. **Set Environment Variables**:
   ```bash
   railway variables set KORA_PRIVATE_KEY="[123,45,67,...]"
   railway variables set RPC_URL="https://api.mainnet-beta.solana.com"
   railway variables set PORT=8080
   ```

4. **Deploy**:
   ```bash
   railway up
   ```

See [railway.json](./railway.json) for full configuration.

### Fly.io Deployment

Fly.io provides edge deployment with global distribution and excellent performance:

#### Quick Start with Fly.io

```bash
# Install Fly.io CLI
curl -L https://fly.io/install.sh | sh

# Or with Homebrew
brew install flyctl

# Login to Fly.io
flyctl auth login

# Copy configuration files
cp kora.toml kora.production.toml
cp signers.toml signers.production.toml
cp .env.example .env

# Edit .env with your configuration
nano .env

# Run deployment script
./deploy-fly.sh setup my-kora-rpc
```

#### Manual Fly.io Setup

1. **Initialize the app**:
   ```bash
   # Create Fly.io app
   flyctl apps create my-kora-rpc

   # Update app name in fly.toml
   # Edit fly.toml and change: app = "my-kora-rpc"
   ```

2. **Configure secrets**:
   ```bash
   # Set private key (from .env file)
   flyctl secrets set KORA_PRIVATE_KEY="[123,45,67,...]"

   # Set RPC URL
   flyctl secrets set RPC_URL="https://api.mainnet-beta.solana.com"

   # Optional: Set authentication
   flyctl secrets set API_KEY="your-api-key"
   flyctl secrets set HMAC_SECRET="your-hmac-secret"
   ```

3. **Deploy**:
   ```bash
   flyctl deploy --remote-only
   ```

4. **Check deployment**:
   ```bash
   # View status
   flyctl status

   # View logs
   flyctl logs

   # Open in browser
   flyctl open
   ```

#### Fly.io Features

**Advantages:**
- **Global edge network** - Deploy close to your users
- **Automatic HTTPS** - Built-in SSL certificates
- **Fast cold starts** - Machines start in ~300ms
- **Flexible scaling** - Auto-scale based on traffic
- **Built-in metrics** - Prometheus-compatible metrics
- **SSH access** - Debug directly in production

**Regions**: Choose from 30+ regions worldwide
```toml
# In fly.toml
primary_region = "sjc"  # San Jose (US West)
# Other options: iad (US East), lhr (London), fra (Frankfurt), nrt (Tokyo), etc.
```

**Scaling**:
```bash
# Scale to 3 instances
flyctl scale count 3

# Scale VM size
flyctl scale vm shared-cpu-2x --memory 2048

# Auto-scale based on traffic
flyctl autoscale set min=1 max=10
```

**Redis on Fly.io** (optional):
```bash
# Create Redis instance
flyctl redis create

# Get Redis URL
flyctl redis status

# Set as secret
flyctl secrets set REDIS_URL="redis://..."
```

See [fly.toml](./fly.toml) and [deploy-fly.sh](./deploy-fly.sh) for full configuration.

### Production Deployment

For production, use this checklist:

#### 1. Security Hardening

- [ ] Use **HashiCorp Vault** or **Turnkey** for key management (not local keypairs)
- [ ] Enable **authentication** (API key + HMAC)
- [ ] Set up **rate limiting** (adjust `rate_limit` in kora.toml)
- [ ] Use **allowlists** for programs and tokens
- [ ] Configure **fee payer policy** to restrict actions
- [ ] Use **HTTPS/TLS** with reverse proxy (nginx, Caddy)

#### 2. Performance Optimization

- [ ] Enable **Redis caching**:
  ```toml
  [kora.cache]
  enabled = true
  url = "redis://redis:6379"
  default_ttl = 300
  account_ttl = 60
  ```

- [ ] Use dedicated **Solana RPC provider** (Helius, QuickNode, Triton)
- [ ] Configure **usage limits**:
  ```toml
  [kora.usage_limit]
  enabled = true
  cache_url = "redis://redis:6379"
  max_transactions = 1000
  ```

- [ ] Use **real-time pricing**:
  ```toml
  [validation]
  price_source = "Jupiter"

  [validation.price]
  type = "margin"
  margin = 0.1  # 10% margin
  ```

#### 3. Monitoring

- [ ] Enable **Prometheus metrics**:
  ```toml
  [metrics]
  enabled = true
  endpoint = "/metrics"
  port = 8080

  [metrics.fee_payer_balance]
  enabled = true
  expiry_seconds = 30
  ```

- [ ] Set up **alerting** for low fee payer balance
- [ ] Monitor **transaction success rates**
- [ ] Track **token account balances**

#### 4. High Availability

- [ ] Deploy **multiple instances** with load balancer
- [ ] Use **multiple signers** with round-robin strategy:
  ```toml
  [signer_pool]
  strategy = "round_robin"

  [[signers]]
  name = "signer_1"
  type = "vault"
  weight = 1

  [[signers]]
  name = "signer_2"
  type = "vault"
  weight = 1
  ```

- [ ] Set up **automatic restarts** (systemd, Docker restart policy)
- [ ] Configure **health checks** (use `/liveness` endpoint)

## Post-Deployment

### Initialize Token Accounts

If you're using a payment address different from your fee payer, initialize the associated token accounts:

```bash
kora --config kora.toml --rpc-url $RPC_URL rpc initialize-atas --signers-config signers.toml
```

This creates token accounts for all `allowed_tokens` at your payment address.

### Test Your Deployment

1. **Health Check**:
   ```bash
   curl https://your-kora-node.com/liveness
   ```

2. **Get Supported Tokens**:
   ```bash
   curl -X POST https://your-kora-node.com \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-api-key" \
     -d '{
       "jsonrpc": "2.0",
       "id": 1,
       "method": "getSupportedTokens"
     }'
   ```

3. **Estimate Transaction Fee**:
   ```bash
   curl -X POST https://your-kora-node.com \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-api-key" \
     -d '{
       "jsonrpc": "2.0",
       "id": 1,
       "method": "estimateTransactionFee",
       "params": {
         "transaction": "base64-encoded-transaction",
         "paymentToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
       }
     }'
   ```

### Integrate with Your Application

From your Rust application, use the Kora SDK or make HTTP requests:

```rust
use reqwest;
use serde_json::json;

async fn sponsor_transaction(tx: &str) -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    let response = client
        .post("https://your-kora-node.com")
        .header("x-api-key", "your-api-key")
        .json(&json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "signAndSendTransaction",
            "params": {
                "transaction": tx,
                "paymentToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
            }
        }))
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    Ok(response["result"]["signature"].as_str().unwrap().to_string())
}
```

Or use the TypeScript SDK:

```typescript
import { KoraClient } from '@kora-labs/kora-sdk';

const client = new KoraClient({
  endpoint: 'https://your-kora-node.com',
  apiKey: 'your-api-key'
});

const signature = await client.signAndSendTransaction({
  transaction: transaction.serialize({ verifySignatures: false }),
  paymentToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
});
```

## Monitoring

### Prometheus Metrics

Kora exposes Prometheus metrics at `/metrics`:

```bash
curl http://localhost:8080/metrics
```

Key metrics to monitor:
- `kora_fee_payer_balance` - Fee payer SOL balance
- `kora_requests_total` - Total RPC requests
- `kora_request_duration_seconds` - Request latency
- `kora_transactions_total` - Total transactions processed
- `kora_transaction_errors_total` - Failed transactions

### Sample Prometheus Configuration

```yaml
scrape_configs:
  - job_name: 'kora'
    static_configs:
      - targets: ['localhost:8080']
    scrape_interval: 30s
```

### Grafana Dashboard

Import the Kora dashboard (coming soon) or create your own panels:

- Fee payer balance over time
- Request rate (requests/second)
- Transaction success rate
- P95/P99 latency
- Token account balances

## Troubleshooting

### Issue: "Insufficient funds" error

**Cause**: Fee payer account has insufficient SOL.

**Solution**: Fund the fee payer account:
```bash
solana transfer <FEE_PAYER_ADDRESS> 1 --url <RPC_URL>
```

### Issue: "Token account not found"

**Cause**: Payment address doesn't have associated token account for payment token.

**Solution**: Initialize token accounts:
```bash
kora --config kora.toml --rpc-url $RPC_URL rpc initialize-atas --signers-config signers.toml
```

### Issue: "Program not allowed"

**Cause**: Transaction uses a program not in `allowed_programs`.

**Solution**: Add the program to `kora.toml`:
```toml
allowed_programs = [
    # ... existing programs
    "YourProgramPubkey11111111111111111111111111", # Your Program
]
```

### Issue: "Authentication failed"

**Cause**: Missing or invalid API key/HMAC signature.

**Solution**:
- Check `x-api-key` header matches `kora.auth.api_key`
- For HMAC: Ensure `x-timestamp` and `x-hmac-signature` are correct
- HMAC signature: `SHA256(timestamp + request_body)` using `hmac_secret`

### Issue: "Rate limit exceeded"

**Cause**: Too many requests.

**Solution**: Increase rate limit in `kora.toml`:
```toml
[kora]
rate_limit = 1000  # Requests per second
```

### View Logs

**Docker**:
```bash
docker-compose logs -f kora
```

**Railway**:
```bash
railway logs
```

**Local**:
```bash
RUST_LOG=debug kora --config kora.toml --rpc-url $RPC_URL rpc start --signers-config signers.toml
```

## Resources

- [Kora Documentation](https://docs.kora.com)
- [GitHub Repository](https://github.com/kora-labs/kora)
- [Example Applications](../../examples/)
- [API Reference](https://docs.kora.com/api)
- [Discord Community](https://discord.gg/kora)

## Support

Need help? Reach out:

- GitHub Issues: https://github.com/kora-labs/kora/issues
- Discord: https://discord.gg/kora
- Email: support@kora.com

---

**Next Steps**:
1. Configure `kora.toml` for your use case
2. Set up your fee payer keypair in `signers.toml`
3. Deploy using your preferred method
4. Initialize token accounts
5. Test your deployment
6. Integrate with your application
7. Monitor and maintain
