# 🔒 Security Hardening Guide for Kora RPC

## Multi-Layer Security Approach

Your app requires a **multi-layer security approach** to ensure only your app users get sponsored transactions:

### Layer 1: Kora Configuration (Server-Side)
### Layer 2: App-Side Validation (Client-Side)
### Layer 3: Authentication (API Keys + HMAC)

---

## 🎯 Your App's Transaction Requirements

Based on your firmware code, valid transactions MUST have:

1. ✅ **Slot Replay Protection** - Assembly program (`23MzuyVH6EKGbUHq7GjBY6ydSCVoZQYDmzeKVdDBKWNQ`)
2. ✅ **juLeso Transfer** - 0.0001 SOL to `juLesoSmdTcRtzjCzYzRoHrnF8GhVu6KCV7uxq7nJGp`
3. ✅ **Jito Tip** - 0.0001 SOL to `Dah1Uu7SW1da337YFRiEEyV1KAjpn7S2HwARCs216L2`

**Any transaction missing these checks should be REJECTED.**

---

## 🛡️ Layer 1: Kora Configuration Hardening

### What Kora CAN Enforce

✅ **Program Whitelist** - Only allow specific programs
✅ **Token Whitelist** - Only accept specific payment tokens
✅ **Fee Payer Policy** - Prevent fee payer abuse
✅ **Authentication** - Require API key + HMAC
✅ **Rate Limiting** - Limit requests per second
✅ **Transaction Size Limits** - Max lamports, max signatures

### What Kora CANNOT Enforce

❌ **Specific instruction sequences** - Can't validate the 3 required transfers
❌ **Transfer amounts** - Can't check for exactly 0.0001 SOL
❌ **Recipient addresses** - Can't validate transfers go to juLeso/Jito

**Solution**: Use app-side validation (Layer 2)

### Deploy Hardened Configuration

```bash
cd examples/deploy

# Use the production-hardened config
cp kora.production.toml kora.toml

# Redeploy
flyctl deploy -a kora-unruggable
```

### Key Security Settings

**Restricted Programs:**
```toml
allowed_programs = [
    "11111111111111111111111111111111",              # System (SOL transfers)
    "23MzuyVH6EKGbUHq7GjBY6ydSCVoZQYDmzeKVdDBKWNQ", # Assembly (your app)
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",   # Token Program
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",  # ATA Program
    "ComputeBudget111111111111111111111111111111",   # Compute Budget
]
```

**All Fee Payer Actions DENIED:**
```toml
[validation.fee_payer_policy.system]
allow_transfer = false       # Prevents SOL draining
allow_assign = false         # Prevents ownership changes
allow_create_account = false # Prevents account spam
allow_allocate = false       # Prevents resource abuse
```

**Token Whitelist:**
```toml
allowed_tokens = [
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", # USDC
    "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", # JLP
]
```

---

## 🔐 Layer 2: App-Side Validation

### Implementation

Add the `app_transaction_validator.rs` module to your app:

```rust
use app_transaction_validator::{validate_app_transaction, ValidationResult};

async fn sponsor_user_transaction(
    tx: VersionedTransaction,
    kora_endpoint: &str,
    api_key: &str,
) -> Result<String> {
    // CRITICAL: Validate BEFORE sending to Kora
    let validation = validate_app_transaction(&tx)?;

    if !validation.is_valid() {
        return Err(anyhow!(
            "Transaction does not meet app requirements: {:?}",
            validation.errors
        ));
    }

    // If validation passes, send to Kora
    let signature = send_to_kora_rpc(&tx, kora_endpoint, api_key).await?;

    Ok(signature)
}
```

### Validation Checks

The validator enforces:

1. ✅ **Assembly program present** - Slot replay protection
2. ✅ **juLeso transfer** - Exactly 0.0001 SOL to correct address
3. ✅ **Jito tip** - Exactly 0.0001 SOL to correct address
4. ✅ **No unauthorized programs** - Only whitelisted programs

### Integration Flow

```
User creates transaction in your app
         ↓
App-side validation (Layer 2) ← REJECTS if checks fail
         ↓
Send to Kora RPC with auth (Layer 3)
         ↓
Kora validation (Layer 1) ← REJECTS if program/token not allowed
         ↓
Kora sponsors & broadcasts
         ↓
Transaction confirmed ✅
```

---

## 🔑 Layer 3: Authentication

### Dual Authentication Required

**1. API Key** (Simple auth)
```bash
curl -H "x-api-key: YOUR_API_KEY" https://kora-unruggable.fly.dev
```

**2. HMAC Signature** (Tamper-proof)
```rust
use hmac::{Hmac, Mac};
use sha2::Sha256;

fn create_hmac_signature(
    timestamp: u64,
    body: &str,
    secret: &str,
) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(timestamp.to_string().as_bytes());
    mac.update(body.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

// Send with headers:
// x-api-key: YOUR_API_KEY
// x-timestamp: UNIX_TIMESTAMP
// x-hmac-signature: SIGNATURE
```

### Rotate Keys Regularly

```bash
# Generate new keys
openssl rand -base64 32  # New API key
openssl rand -base64 64  # New HMAC secret

# Update in Fly.io
flyctl secrets set API_KEY="new-key" -a kora-unruggable
flyctl secrets set HMAC_SECRET="new-secret" -a kora-unruggable
```

---

## 🚨 Attack Vectors & Mitigations

### Attack 1: Malicious Transaction Without Required Transfers

**Attack**: User sends transaction missing juLeso/Jito transfers

**Kora Protection**: ❌ Cannot detect (doesn't validate specific transfers)
**App Protection**: ✅ BLOCKED by `validate_app_transaction()`

**Mitigation**: Always validate in your app before sending to Kora

---

### Attack 2: Fee Payer Draining

**Attack**: User creates transaction where fee payer transfers SOL/tokens to attacker

**Kora Protection**: ✅ BLOCKED by fee_payer_policy (all actions denied)
**App Protection**: ✅ BLOCKED by program whitelist

**Mitigation**: Keep all fee_payer_policy `allow_*` set to `false`

---

### Attack 3: Unauthorized Program Execution

**Attack**: User calls unapproved program (DEX, NFT marketplace, etc.)

**Kora Protection**: ✅ BLOCKED by `allowed_programs` whitelist
**App Protection**: ✅ BLOCKED by `check_only_allowed_programs()`

**Mitigation**: Only whitelist programs your app needs

---

### Attack 4: API Replay Attack

**Attack**: Attacker intercepts and replays valid API requests

**Kora Protection**: ✅ BLOCKED by HMAC timestamp validation
**App Protection**: N/A

**Mitigation**: HMAC prevents replay attacks (timestamp must be recent)

---

### Attack 5: Excessive Fee Draining

**Attack**: User submits many small transactions to drain fee payer

**Kora Protection**: ✅ RATE LIMITED (100 req/sec default)
**App Protection**: Add usage limits per user

**Mitigation**:
1. Enable rate limiting in Kora
2. Track usage per user in your app
3. Enable Redis usage limits:
   ```toml
   [kora.usage_limit]
   enabled = true
   max_transactions = 1000
   ```

---

## 📊 Monitoring & Alerts

### Critical Metrics to Monitor

1. **Fee Payer Balance** - Alert if below threshold
   ```bash
   curl https://kora-unruggable.fly.dev/metrics | grep kora_fee_payer_balance
   ```

2. **Request Rate** - Detect unusual spikes
   ```bash
   curl https://kora-unruggable.fly.dev/metrics | grep kora_requests_total
   ```

3. **Transaction Success Rate** - Detect validation failures
   ```bash
   curl https://kora-unruggable.fly.dev/metrics | grep kora_transactions_total
   ```

4. **Authentication Failures** - Detect brute force attempts
   ```bash
   flyctl logs -a kora-unruggable | grep "authentication failed"
   ```

### Set Up Alerts

**Low Balance Alert:**
```bash
# Check balance every 5 minutes
*/5 * * * * curl -s https://kora-unruggable.fly.dev/metrics | \
  grep kora_fee_payer_balance | \
  awk '{if ($2 < 0.1) print "ALERT: Low balance"}' | \
  mail -s "Kora Alert" your@email.com
```

**High Request Rate Alert:**
```bash
# Alert if >500 req/sec
flyctl logs -a kora-unruggable --follow | \
  grep "rate limit" | \
  mail -s "Rate Limit Alert" your@email.com
```

---

## 🔧 Deployment Checklist

### Pre-Deployment

- [ ] Review `kora.production.toml` settings
- [ ] Generate strong API key (32+ chars)
- [ ] Generate strong HMAC secret (64+ chars)
- [ ] Test app-side validation with real transactions
- [ ] Fund fee payer with adequate SOL (0.5-1 SOL for testing)

### Deploy Hardened Config

```bash
cd examples/deploy

# 1. Copy production config
cp kora.production.toml kora.toml

# 2. Deploy
flyctl deploy -a kora-unruggable

# 3. Initialize token accounts
flyctl ssh console -a kora-unruggable
kora --config kora.toml --rpc-url $RPC_URL rpc initialize-atas --signers-config signers.toml
exit

# 4. Test with valid transaction
# (Should succeed)

# 5. Test with invalid transaction (missing checks)
# (Should fail app-side validation)
```

### Post-Deployment

- [ ] Verify health: `curl https://kora-unruggable.fly.dev/liveness`
- [ ] Test authentication with valid credentials
- [ ] Test rejection of unauthorized programs
- [ ] Test rejection of transactions missing required transfers
- [ ] Monitor logs for first hour
- [ ] Set up balance alerts
- [ ] Document API keys securely (password manager)

---

## 🔐 Security Best Practices

### 1. Never Expose Credentials

```bash
# ❌ BAD - Credentials in code
const API_KEY = "fB7moAtNtMocaF5tM2u41ynnp6rb5ezoVMdxpbS9Ph4=";

# ✅ GOOD - Credentials in environment
const API_KEY = process.env.KORA_API_KEY;
```

### 2. Validate Client-Side First

```rust
// ❌ BAD - Send without validation
send_to_kora(&tx).await?;

// ✅ GOOD - Validate first
let validation = validate_app_transaction(&tx)?;
if !validation.is_valid() {
    return Err(anyhow!("Invalid transaction"));
}
send_to_kora(&tx).await?;
```

### 3. Limit What Fee Payer Can Do

```toml
# ❌ BAD - Permissive
allow_transfer = true
allow_burn = true

# ✅ GOOD - Restrictive (deny all)
allow_transfer = false
allow_burn = false
```

### 4. Rotate Keys Regularly

```bash
# Every 90 days
openssl rand -base64 32 > new_api_key.txt
flyctl secrets set API_KEY="$(cat new_api_key.txt)" -a kora-unruggable
```

### 5. Monitor Continuously

```bash
# Set up continuous monitoring
flyctl logs -a kora-unruggable --follow | grep -E "ERROR|WARN|authentication failed"
```

---

## 🆘 Incident Response

### If Fee Payer Compromised

1. **Immediately stop the machine**:
   ```bash
   flyctl apps stop kora-unruggable
   ```

2. **Transfer remaining SOL**:
   ```bash
   solana transfer <SAFE_ADDRESS> ALL --from <FEE_PAYER_KEYPAIR>
   ```

3. **Generate new keypair**:
   ```bash
   solana-keygen new -o new-feepayer.json
   ```

4. **Rotate credentials**:
   ```bash
   flyctl secrets set KORA_PRIVATE_KEY="$(cat new-feepayer.json)" -a kora-unruggable
   flyctl secrets set API_KEY="$(openssl rand -base64 32)" -a kora-unruggable
   ```

5. **Restart with new config**:
   ```bash
   flyctl apps start kora-unruggable
   ```

### If Unusual Activity Detected

1. **Check logs**:
   ```bash
   flyctl logs -a kora-unruggable | tail -1000
   ```

2. **Check metrics**:
   ```bash
   curl https://kora-unruggable.fly.dev/metrics
   ```

3. **If suspicious, enable stricter rate limits**:
   ```toml
   rate_limit = 10  # Reduce from 100
   ```

4. **Review recent transactions on explorer**

---

## 📚 Summary

**3-Layer Security:**
1. ✅ Kora Config - Program/token whitelist, fee payer policy, auth
2. ✅ App Validation - Enforce 3 required checks before sending
3. ✅ Authentication - API key + HMAC prevents unauthorized access

**Always validate transactions in your app BEFORE sending to Kora!**

The combination of:
- Restrictive Kora configuration
- App-side transaction validation
- Dual authentication (API key + HMAC)
- Continuous monitoring

Ensures only your app's legitimate transactions get sponsored.

---

## 🔗 Next Steps

1. Deploy hardened config: `flyctl deploy -a kora-unruggable`
2. Add validator to your app: Include `app_transaction_validator.rs`
3. Test with valid/invalid transactions
4. Set up monitoring and alerts
5. Document for your team

**Questions? Check the main deployment guide or reach out for help!**
