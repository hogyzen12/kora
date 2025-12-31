# Kora RPC Quick Start Guide

Deploy your Kora RPC node in 5 minutes! Choose your deployment method:

## 🚀 Option 1: Fly.io (Recommended for Production)

**Advantages**: Global edge network, automatic HTTPS, fast scaling

```bash
# 1. Install Fly.io CLI
curl -L https://fly.io/install.sh | sh

# 2. Login
flyctl auth login

# 3. Setup environment
cd examples/deploy
cp .env.example .env
nano .env  # Add your KORA_PRIVATE_KEY and RPC_URL

# 4. Deploy!
./deploy-fly.sh setup my-kora-rpc

# Your Kora RPC is now live! 🎉
```

**Test it:**
```bash
curl https://my-kora-rpc.fly.dev/liveness
```

## 🐳 Option 2: Docker (Local or VPS)

**Advantages**: Easy local testing, full control

```bash
# 1. Setup environment
cd examples/deploy
cp .env.example .env
nano .env  # Add your KORA_PRIVATE_KEY and RPC_URL

# 2. Deploy with Docker Compose
docker-compose up -d

# 3. Test it
curl http://localhost:8080/liveness
```

**With monitoring (Prometheus + Grafana):**
```bash
docker-compose --profile monitoring up -d

# Access Grafana at http://localhost:3000 (admin/admin)
```

## 🚂 Option 3: Railway

**Advantages**: One-click deployment, simple pricing

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login and deploy
railway login
railway init
railway variables set KORA_PRIVATE_KEY="[123,45,67,...]"
railway variables set RPC_URL="https://api.mainnet-beta.solana.com"
railway up
```

## 💻 Option 4: Local Development

**For testing only:**

```bash
# 1. Install Kora CLI
cargo install kora-cli

# 2. Setup config
cd examples/deploy
export KORA_PRIVATE_KEY="$(cat /path/to/keypair.json)"
export RPC_URL="http://127.0.0.1:8899"

# 3. Start server
kora --config kora.toml --rpc-url $RPC_URL rpc start --signers-config signers.toml
```

## 📋 Before You Deploy

### 1. Generate a Keypair

```bash
# Generate new keypair
solana-keygen new -o keypair.json

# Get the public key
solana-keygen pubkey keypair.json

# Fund it (devnet)
solana airdrop 2 $(solana-keygen pubkey keypair.json) --url https://api.devnet.solana.com
```

### 2. Prepare Configuration

**Edit `kora.toml`:**
```toml
[validation]
# Use "Jupiter" for real prices, "Mock" for testing
price_source = "Jupiter"

# Tokens you accept
allowed_tokens = [
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", # USDC
]

# Programs users can interact with
allowed_programs = [
    "11111111111111111111111111111111",  # System
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", # Token Program
    # Add more programs...
]
```

**Set environment variables:**
```bash
# Your fee payer private key (in array format or base58)
KORA_PRIVATE_KEY="[123,45,67,...]"

# Solana RPC endpoint
RPC_URL="https://api.mainnet-beta.solana.com"

# Optional: Authentication
API_KEY="your-secure-api-key"
HMAC_SECRET="your-hmac-secret"
```

## 🧪 Test Your Deployment

### 1. Health Check
```bash
curl https://your-kora-node.com/liveness
# Expected: {"status":"ok"}
```

### 2. Get Supported Tokens
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

### 3. Get Configuration
```bash
curl -X POST https://your-kora-node.com \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getConfig"
  }'
```

## 📊 Initialize Token Accounts (Required)

Before processing transactions, initialize token accounts:

```bash
# For Fly.io
flyctl ssh console -C "kora --config kora.toml --rpc-url \$RPC_URL rpc initialize-atas --signers-config signers.toml"

# For Docker
docker exec kora-rpc kora --config kora.toml --rpc-url $RPC_URL rpc initialize-atas --signers-config signers.toml

# For Local
kora --config kora.toml --rpc-url $RPC_URL rpc initialize-atas --signers-config signers.toml
```

## 🔗 Integration Example

### TypeScript SDK

```typescript
import { KoraClient } from '@kora-labs/kora-sdk';

const client = new KoraClient({
  endpoint: 'https://your-kora-node.com',
  apiKey: 'your-api-key'
});

// Sign and send transaction
const signature = await client.signAndSendTransaction({
  transaction: tx.serialize({ verifySignatures: false }),
  paymentToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC
});

console.log('Transaction sent:', signature);
```

### Rust

```rust
use reqwest;
use serde_json::json;

let response = reqwest::Client::new()
    .post("https://your-kora-node.com")
    .header("x-api-key", "your-api-key")
    .json(&json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "signAndSendTransaction",
        "params": {
            "transaction": base64_tx,
            "paymentToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        }
    }))
    .send()
    .await?;
```

## 🛠️ Helper Scripts

All deployment methods include helper scripts:

```bash
# Docker
./deploy.sh setup       # Create .env file
./deploy.sh deploy      # Deploy with Docker
./deploy.sh logs        # View logs
./deploy.sh health      # Check health
./deploy.sh test        # Test RPC methods

# Fly.io
./deploy-fly.sh setup my-kora-rpc  # Full setup
./deploy-fly.sh logs               # View logs
./deploy-fly.sh status             # Check status
./deploy-fly.sh scale 3            # Scale to 3 instances

# Or use justfile
just deploy             # Docker deployment
just deploy-fly         # Fly.io deployment
just test               # Test RPC
just health             # Health check
```

## 📚 Next Steps

1. **Read the full guide**: [README.md](./README.md)
2. **Configure security**: Enable API key and HMAC authentication
3. **Set up monitoring**: Enable Prometheus metrics and Grafana
4. **Optimize performance**: Enable Redis caching, use dedicated RPC
5. **Scale your deployment**: Add multiple signers, enable auto-scaling

## 🆘 Troubleshooting

**"Insufficient funds" error**
→ Fund your fee payer: `solana transfer <FEE_PAYER> 1 --url <RPC_URL>`

**"Token account not found"**
→ Initialize token accounts: See "Initialize Token Accounts" above

**"Authentication failed"**
→ Check your `x-api-key` header matches `kora.toml`

**More help:**
- [Full README](./README.md)
- [GitHub Issues](https://github.com/kora-labs/kora/issues)
- [Documentation](https://docs.kora.com)

---

**Ready to deploy?** Choose your platform above and get started! 🚀
