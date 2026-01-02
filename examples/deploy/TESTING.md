# Testing Your Kora RPC Node

Now that your Kora RPC is deployed and running, here's how to test it:

## 🎯 Quick API Health Check (30 seconds)

First, verify your API is responding:

```bash
cd examples/deploy
./test-kora-simple.sh
```

This will test:
- ✅ Liveness endpoint
- ✅ getSupportedTokens (USDC + JLP)
- ✅ getPayerSigner (fee payer address)
- ✅ Fee payer SOL balance
- ✅ getConfig (full configuration with security hardening)

**Expected output:**
```
✅ All basic API tests completed!

📊 Current Status:
   - Endpoint: https://kora-unruggable.fly.dev
   - Fee Payer: KoRaXJTbWuDNgCFdhu6dygok5Fh1dcQB6iLxuDNLoiN
   - Balance: 0.0399 SOL
   - Authentication: ❌ DISABLED (test mode)
```

---

## 🚀 Test Transaction Sponsorship (RECOMMENDED)

**This is the most important test** - it verifies Kora can actually sponsor transactions!

### Option 1: Node.js Test (Easiest!)

**Requirements:**
```bash
npm install @solana/web3.js
```

**Step 1: Create a funded test wallet**

You need a wallet with at least 0.0003 SOL (for the juLeso and Jito transfers):

```bash
# Quick way: Use the helper script
node create-test-wallet.js

# This creates test-wallet.json and shows you the address
# Fund that address with 0.001 SOL from your main wallet
```

**Step 2: Run the test**

```bash
# With your funded keypair
node test-sponsorship.js test-wallet.json

# Or with any other keypair file
node test-sponsorship.js /path/to/keypair.json
```

See [CREATE_TEST_WALLET.md](CREATE_TEST_WALLET.md) for detailed instructions.

**What it does:**
1. Creates a transaction with the 3 required checks:
   - Assembly/Slot Replay program instruction
   - 0.0001 SOL transfer to juLeso (`juLesoSmdTcRtzjCzYzRoHrnF8GhVu6KCV7uxq7nJGp`)
   - 0.0001 SOL transfer to Jito (`Dah1Uu7SW1da337YFRiEEyV1KAjpn7S2HwARCs216L2`)
2. Tests `estimateTransactionFee` - Shows cost in USDC
3. Tests `signTransaction` - Gets signed transaction from Kora
4. Shows results without actually broadcasting (dry run mode)

**Expected output:**
```
✅ Transaction Sponsorship Tests PASSED!

📊 Results:
   ✅ Fee estimation: Working
   ✅ Transaction signing: Working
   ✅ Kora can sponsor transactions with USDC payment

💰 Cost per transaction:
   0.000500 USDC (0.000005000 SOL equivalent)
```

---

### Option 2: Python Test

**Requirements:**
```bash
pip install solders requests
```

**Run:**
```bash
cd examples/deploy
python3 test-transaction.py
```

**What it does:**
- Same as Node.js test, but using Python
- Creates transaction with 3 required checks
- Tests fee estimation and signing

---

### Option 3: Simple Bash Test (No dependencies!)

**Run:**
```bash
cd examples/deploy
./test-sponsorship-simple.sh
```

**What it does:**
- Shows you how to test with curl commands
- Provides example RPC calls
- Guides you through the process

---

### Option 4: Manual curl Test

**Get supported tokens:**
```bash
curl -X POST https://kora-unruggable.fly.dev \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getSupportedTokens"
  }' | jq
```

**Get fee payer:**
```bash
curl -X POST https://kora-unruggable.fly.dev \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getPayerSigner"
  }' | jq
```

**Get configuration:**
```bash
curl -X POST https://kora-unruggable.fly.dev \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getConfig"
  }' | jq
```

---

## 🔍 Monitoring & Debugging

### Check Kora Logs

```bash
flyctl logs -a kora-unruggable
```

**Look for:**
- Server startup messages
- RPC request logs
- Transaction validation logs
- Error messages

### Check Fee Payer Balance

```bash
# Via Solana Explorer
https://explorer.solana.com/address/KoRaXJTbWuDNgCFdhu6dygok5Fh1dcQB6iLxuDNLoiN

# Via curl
curl -X POST https://api.mainnet-beta.solana.com \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getBalance",
    "params": ["KoRaXJTbWuDNgCFdhu6dygok5Fh1dcQB6iLxuDNLoiN"]
  }' | jq
```

### Check Token Accounts

**USDC ATA:**
```bash
# Address: DsjkCnvUvP1auZUuHYqN1atYnGcKvCyqhwfCiy63Vp8y
https://explorer.solana.com/address/DsjkCnvUvP1auZUuHYqN1atYnGcKvCyqhwfCiy63Vp8y
```

**JLP ATA:**
```bash
# Address: 6QK9PKC95yrSvnwLUcJHdTgvKZaHnqhmSFVUPqHkPGeD
https://explorer.solana.com/address/6QK9PKC95yrSvnwLUcJHdTgvKZaHnqhmSFVUPqHkPGeD
```

---

## 🚨 Troubleshooting

### Error: "Connection timeout"

**Check server status:**
```bash
flyctl status -a kora-unruggable
```

**Restart server:**
```bash
flyctl apps restart kora-unruggable
```

### Error: "Fee payer has insufficient balance"

**Fund fee payer:**
```bash
# Send SOL to: KoRaXJTbWuDNgCFdhu6dygok5Fh1dcQB6iLxuDNLoiN
# Recommended: 0.5-1 SOL for testing
```

### Error: "Program not allowed"

**Check allowed_programs in kora.toml:**
```toml
allowed_programs = [
    "11111111111111111111111111111111",              # System
    "23MzuyVH6EKGbUHq7GjBY6ydSCVoZQYDmzeKVdDBKWNQ", # Assembly
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",   # Token
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",  # ATA
    "ComputeBudget111111111111111111111111111111",   # Compute Budget
]
```

### Error: "Payment token not supported"

**Check allowed_tokens in kora.toml:**
```toml
allowed_tokens = [
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", # USDC
    "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", # JLP
]
```

---

## ✅ Test Checklist

Before deploying to production:

- [ ] ✅ Basic API tests pass (`test-kora-simple.sh`)
- [ ] ✅ Fee payer has sufficient SOL (>0.1 SOL recommended)
- [ ] ✅ Token accounts initialized (USDC + JLP)
- [ ] ✅ Transaction sponsorship works (`test-transaction.py`)
- [ ] ✅ Fee estimation accurate for both tokens
- [ ] ⚠️  Authentication enabled (API Key + HMAC)
- [ ] ⚠️  Security hardening deployed (`kora.production.toml`)
- [ ] ⚠️  App-side validation implemented (`app_transaction_validator.rs`)
- [ ] ⚠️  Monitoring and alerts configured

---

## 🔐 Next Steps: Enable Security

Once testing is complete, enable authentication and security:

1. **Enable Authentication:**
   ```bash
   # Copy production config
   cp kora.production.toml kora.toml

   # Redeploy
   flyctl deploy -a kora-unruggable
   ```

2. **Update API Calls:**
   ```bash
   # Add authentication headers
   curl -X POST https://kora-unruggable.fly.dev \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY" \
     -H "x-timestamp: $(date +%s)" \
     -H "x-hmac-signature: SIGNATURE" \
     -d '{"jsonrpc":"2.0","id":1,"method":"getSupportedTokens"}'
   ```

3. **Integrate App Validator:**
   - Add `app_transaction_validator.rs` to your app
   - Validate transactions before sending to Kora
   - See `SECURITY_HARDENING.md` for full guide

---

## 📚 Resources

- **Security Guide:** `SECURITY_HARDENING.md`
- **Deployment Guide:** `README.md`
- **Quick Start:** `QUICKSTART.md`
- **Credentials:** `unruggable-credentials.txt` (keep secure!)

---

## 🎉 Success Criteria

Your Kora RPC is working if:

✅ All endpoints respond correctly
✅ Fee estimation returns valid amounts
✅ Transactions can be signed
✅ Fee payer has sufficient balance
✅ Token accounts exist for USDC + JLP

**You're ready to integrate with your app!** 🚀
