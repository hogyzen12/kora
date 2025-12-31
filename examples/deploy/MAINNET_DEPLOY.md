# 🚀 Deploy "unruggable" to Mainnet - Step by Step

## 🔐 Authentication in Kora

Kora supports two authentication methods (both enabled for security):

### 1. **API Key Authentication**
- Simple header-based authentication
- Client sends: `x-api-key: your-secret-api-key`
- Good for: Internal services, backend-to-backend

**Example:**
```bash
curl -X POST https://unruggable.fly.dev \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getSupportedTokens"}'
```

### 2. **HMAC Signature Authentication**
- Request signing for tamper-proof requests
- Client sends:
  - `x-timestamp: <unix-timestamp>` (current time)
  - `x-hmac-signature: <signature>` (HMAC-SHA256 hash)
- Prevents: Replay attacks, request tampering
- Good for: Public APIs, untrusted clients

**How to generate HMAC signature:**
```javascript
const crypto = require('crypto');

const timestamp = Math.floor(Date.now() / 1000).toString();
const body = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "getSupportedTokens"
});

const message = timestamp + body;
const signature = crypto
  .createHmac('sha256', HMAC_SECRET)
  .update(message)
  .digest('hex');

// Send with headers:
// x-timestamp: timestamp
// x-hmac-signature: signature
```

**Example with both API Key + HMAC:**
```bash
TIMESTAMP=$(date +%s)
BODY='{"jsonrpc":"2.0","id":1,"method":"getSupportedTokens"}'
SIGNATURE=$(echo -n "$TIMESTAMP$BODY" | openssl dgst -sha256 -hmac "$HMAC_SECRET" -hex | cut -d' ' -f2)

curl -X POST https://unruggable.fly.dev \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "x-timestamp: $TIMESTAMP" \
  -H "x-hmac-signature: $SIGNATURE" \
  -d "$BODY"
```

---

## 📋 Prerequisites

1. **Your mainnet keypair** (funded with SOL for fees)
2. **Fly.io account** (free tier works)
3. **Solana RPC provider** (Helius, QuickNode, etc. - recommended for production)

---

## 🎯 Deployment Steps

### Step 1: Navigate to deploy directory
```bash
cd /home/user/kora/examples/deploy
export PATH="/root/.fly/bin:$PATH"
```

### Step 2: Provide your keypair

**Choose ONE option:**

**Option A - Copy existing keypair file:**
```bash
cp /path/to/your/mainnet-keypair.json unruggable-feepayer.json
```

**Option B - Create from array format:**
```bash
cat > unruggable-feepayer.json << 'EOF'
[your,private,key,bytes,here...]
EOF
```

**Option C - Create from base58:**
If you have a base58 private key, let me know and I'll help convert it.

### Step 3: Run the deployment script
```bash
./deploy-unruggable.sh
```

The script will:
1. ✅ Check your keypair exists
2. ✅ Generate secure API_KEY and HMAC_SECRET automatically
3. ✅ Ask for your RPC URL (you can use default or your own)
4. ✅ Configure everything for mainnet
5. ✅ Login to Fly.io (opens browser)
6. ✅ Deploy to https://unruggable.fly.dev
7. ✅ Save your credentials to `unruggable-credentials.txt`

---

## 🔑 After Deployment

### 1. Your credentials will be displayed and saved

The script generates strong random keys:
- **API Key**: 43-character secure key
- **HMAC Secret**: 86-character secure secret

These are saved to: `unruggable-credentials.txt`

**⚠️ IMPORTANT: Keep these credentials secure!**

### 2. Test the deployment

```bash
# Health check (no auth required)
curl https://unruggable.fly.dev/liveness

# Get supported tokens (requires auth)
curl -X POST https://unruggable.fly.dev \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getSupportedTokens"}'
```

### 3. Initialize token accounts (REQUIRED)

```bash
# SSH into your Fly.io app
flyctl ssh console -a unruggable

# Inside the container:
kora --config kora.toml --rpc-url $RPC_URL rpc initialize-atas --signers-config signers.toml

# Exit
exit
```

This creates associated token accounts for USDC and any other tokens you configured.

---

## 🎛️ Configuration

### Mainnet Configuration (`kora.mainnet.toml`)

**Key settings:**
- ✅ Authentication: API Key + HMAC (both required)
- ✅ Price source: Jupiter (real-time prices)
- ✅ Default tokens: USDC mainnet
- ✅ Max transaction: 0.01 SOL
- ✅ Metrics: Enabled with Prometheus endpoint
- ✅ Fee payer policy: Secure defaults

**To add more tokens:**
Edit `kora.mainnet.toml`:
```toml
allowed_tokens = [
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", # USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", # USDT
    "So11111111111111111111111111111111111111112",  # Wrapped SOL
]
```

**To add more programs (DEXes, etc.):**
```toml
allowed_programs = [
    # ... existing programs
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", # Jupiter v6
    "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc", # Orca Whirlpool
]
```

Then redeploy:
```bash
flyctl deploy -a unruggable
```

---

## 📊 Managing Your Deployment

### View logs
```bash
flyctl logs -a unruggable
```

### Check status
```bash
flyctl status -a unruggable
```

### View metrics
```bash
curl https://unruggable.fly.dev/metrics
```

### Scale up
```bash
# Scale to 2 instances
flyctl scale count 2 -a unruggable

# Increase memory
flyctl scale vm shared-cpu-2x --memory 2048 -a unruggable
```

### Update secrets
```bash
flyctl secrets set API_KEY="new-key" -a unruggable
flyctl secrets set HMAC_SECRET="new-secret" -a unruggable
```

### Restart
```bash
flyctl apps restart unruggable
```

---

## 🧪 Testing with Authentication

### TypeScript Example

```typescript
import crypto from 'crypto';

const API_KEY = 'your-api-key';
const HMAC_SECRET = 'your-hmac-secret';
const ENDPOINT = 'https://unruggable.fly.dev';

async function callKoraRPC(method: string, params?: any) {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method,
    params
  });

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(timestamp + body)
    .digest('hex');

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-timestamp': timestamp,
      'x-hmac-signature': signature
    },
    body
  });

  return response.json();
}

// Usage
const tokens = await callKoraRPC('getSupportedTokens');
console.log('Supported tokens:', tokens);
```

### Rust Example

```rust
use reqwest;
use serde_json::json;
use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

async fn call_kora_rpc(
    method: &str,
    params: Option<serde_json::Value>,
    api_key: &str,
    hmac_secret: &str,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params
    });

    let body_str = serde_json::to_string(&body)?;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs()
        .to_string();

    let mut mac = HmacSha256::new_from_slice(hmac_secret.as_bytes())?;
    mac.update(timestamp.as_bytes());
    mac.update(body_str.as_bytes());
    let signature = hex::encode(mac.finalize().into_bytes());

    let client = reqwest::Client::new();
    let response = client
        .post("https://unruggable.fly.dev")
        .header("Content-Type", "application/json")
        .header("x-api-key", api_key)
        .header("x-timestamp", &timestamp)
        .header("x-hmac-signature", &signature)
        .body(body_str)
        .send()
        .await?
        .json()
        .await?;

    Ok(response)
}
```

---

## 🛡️ Security Best Practices

1. **Never commit credentials** to git
2. **Rotate keys regularly** (every 90 days)
3. **Use environment variables** for secrets
4. **Enable rate limiting** in kora.toml
5. **Monitor for unusual activity** in logs
6. **Keep fee payer funded** but not over-funded
7. **Use dedicated RPC** (not public endpoints)
8. **Set up alerts** for low balance

---

## 🔍 Troubleshooting

**Issue: "Insufficient funds"**
- Fund your fee payer with SOL
- Check balance: `solana balance FEEPAYER_PUBKEY --url mainnet`

**Issue: "Token account not found"**
- Run Step 3 to initialize token accounts

**Issue: "Authentication failed"**
- Verify API key in your requests
- Check HMAC signature generation
- Ensure timestamp is current (within 5 minutes)

**Issue: "Transaction failed"**
- Check if programs are in `allowed_programs`
- Verify token is in `allowed_tokens`
- Check transaction doesn't exceed `max_allowed_lamports`

---

## 📚 Resources

- Full deployment guide: [README.md](./README.md)
- Quick start: [QUICKSTART.md](./QUICKSTART.md)
- Fly.io docs: https://fly.io/docs
- Kora docs: https://docs.kora.com

---

**Ready to deploy?** Just run:
```bash
./deploy-unruggable.sh
```

🎉 Your "unruggable" Kora RPC will be live at https://unruggable.fly.dev!
