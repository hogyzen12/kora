# 🚀 Deploy Your Kora RPC Node to Fly.io - Step by Step

Follow these exact steps to deploy your Kora node:

## ✅ Step 1: You are here! (Already done)
- You're in `/home/user/kora/examples/deploy` ✓
- Fly.io CLI is installed ✓
- `.env` file created ✓

## 📝 Step 2: Get your Solana keypair

You need a funded Solana keypair to pay for transaction fees. Choose ONE option:

### Option A: If you have an existing keypair
```bash
# Copy your existing keypair to this directory
cp /path/to/your/keypair.json kora-feepayer.json
```

### Option B: Generate a new keypair (recommended for production)

**Method 1**: Use Solana CLI (when available)
```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
export PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

# Generate keypair
solana-keygen new -o kora-feepayer.json --no-bip39-passphrase

# Get public key
solana-keygen pubkey kora-feepayer.json

# Fund it (devnet)
solana airdrop 2 $(solana-keygen pubkey kora-feepayer.json) --url https://api.devnet.solana.com
```

**Method 2**: Generate online at https://solana-keygen.vercel.app/
1. Visit the website
2. Click "Generate New Keypair"
3. Download the JSON file
4. Save it as `kora-feepayer.json` in this directory

**Method 3**: Use an existing wallet's export feature
- Phantom: Settings → Export Private Key → Save as JSON
- Solflare: Settings → Export Wallet → Download JSON

### Option C: For quick testing (devnet only)
```bash
# Use a test keypair (I'll create one for you)
cat > kora-feepayer.json << 'EOF'
[176,196,223,60,125,21,145,127,72,144,168,102,205,95,50,164,8,132,24,115,209,129,86,132,74,189,206,73,52,147,134,158,186,75,162,228,92,208,210,233,83,165,222,148,28,243,73,231,145,240,203,24,23,77,48,211,177,164,232,163,28,81,175,140]
EOF
echo "✓ Test keypair created (for devnet testing only)"
```

## 📋 Step 3: Configure your .env file

Now edit your `.env` file with your settings:

```bash
nano .env
```

**Required settings** (update these):

```bash
# 1. Set your RPC URL (choose one)
# For devnet testing:
RPC_URL=https://api.devnet.solana.com

# For mainnet production (use a reliable RPC provider):
# RPC_URL=https://your-rpc-provider.com

# 2. Set your keypair
KORA_PRIVATE_KEY="$(cat kora-feepayer.json)"

# 3. Set the port (default is fine)
PORT=8080

# 4. Set logging level
RUST_LOG=info
```

**Optional but recommended** (for production):

```bash
# Authentication (highly recommended for production)
API_KEY=your-super-secret-api-key-change-this
HMAC_SECRET=your-super-secret-hmac-secret-change-this
```

Save and exit (Ctrl+X, then Y, then Enter)

## 🎯 Step 4: Update kora.toml configuration

Edit `kora.toml` to set which tokens you'll accept:

```bash
nano kora.toml
```

**Key settings to update:**

```toml
[validation]
# For real price data (production):
price_source = "Jupiter"

# For testing:
# price_source = "Mock"

# Tokens you'll accept as payment
allowed_tokens = [
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", # USDC mainnet
    # "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", # USDC devnet
]
```

For **devnet testing**, use:
```toml
allowed_tokens = [
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", # USDC devnet
]
```

Save and exit.

## 🔐 Step 5: Login to Fly.io

```bash
export PATH="/root/.fly/bin:$PATH"
flyctl auth login
```

This will open a browser. Login or create a free Fly.io account.

## 🚀 Step 6: Deploy to Fly.io!

```bash
# Make deploy script executable (if not already)
chmod +x deploy-fly.sh

# Deploy! (replace 'my-kora-rpc' with your preferred app name)
./deploy-fly.sh setup my-kora-rpc
```

The script will:
1. Create a Fly.io app
2. Set your environment secrets
3. Build and deploy your Kora RPC node
4. Show you the app URL

**That's it!** 🎉

## ✅ Step 7: Verify deployment

Once deployed, test your Kora node:

```bash
# Health check
curl https://my-kora-rpc.fly.dev/liveness

# Expected response: {"status":"ok"}
```

## 🔧 Step 8: Initialize token accounts (REQUIRED)

Your Kora node needs associated token accounts for each token you accept:

```bash
# SSH into your Fly.io app
flyctl ssh console -a my-kora-rpc

# Inside the container, run:
kora --config kora.toml --rpc-url $RPC_URL rpc initialize-atas --signers-config signers.toml

# Exit the SSH session
exit
```

## 🧪 Step 9: Test your RPC endpoints

```bash
# Get supported tokens
curl -X POST https://my-kora-rpc.fly.dev \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getSupportedTokens"
  }'

# Get config
curl -X POST https://my-kora-rpc.fly.dev \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getConfig"
  }'
```

## 📊 Useful Fly.io Commands

```bash
# View logs
flyctl logs -a my-kora-rpc

# Check status
flyctl status -a my-kora-rpc

# Scale to 2 instances
flyctl scale count 2 -a my-kora-rpc

# Scale VM size
flyctl scale vm shared-cpu-2x --memory 2048 -a my-kora-rpc

# SSH into app
flyctl ssh console -a my-kora-rpc

# Restart app
flyctl apps restart my-kora-rpc

# Destroy app (careful!)
flyctl apps destroy my-kora-rpc
```

## 🔍 Troubleshooting

**Issue: "Insufficient funds"**
- Your fee payer needs SOL for transaction fees
- Fund it: `solana transfer <PUBKEY> 1 --url <RPC_URL>`

**Issue: "Token account not found"**
- Run Step 8 to initialize token accounts

**Issue: "Authentication failed"**
- Make sure your API_KEY matches in .env and your requests
- For HMAC, ensure proper signature generation

**Issue: Deployment fails**
- Check logs: `flyctl logs -a my-kora-rpc`
- Verify .env settings are correct
- Ensure keypair is valid JSON format

## 🎯 Next Steps

1. **Monitor your node**: Check metrics at `https://my-kora-rpc.fly.dev/metrics`
2. **Set up monitoring**: Use Prometheus/Grafana for alerts
3. **Integrate with your app**: Use the TypeScript SDK or HTTP requests
4. **Scale as needed**: Fly.io makes scaling easy

## 📚 Resources

- Full README: [README.md](./README.md)
- Quick Start: [QUICKSTART.md](./QUICKSTART.md)
- Fly.io Docs: https://fly.io/docs
- Kora Docs: https://docs.kora.com

---

**You're all set! Your Kora RPC node is now live and ready to sponsor transactions!** 🎉

Your endpoint: `https://my-kora-rpc.fly.dev`
