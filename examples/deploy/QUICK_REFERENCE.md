# 🚀 Unruggable Deployment - Quick Reference

## One-Command Deploy

```bash
cd /home/user/kora/examples/deploy
export PATH="/root/.fly/bin:$PATH"

# 1. Add your keypair
cp /path/to/your/mainnet-keypair.json unruggable-feepayer.json

# 2. Deploy!
./deploy-unruggable.sh
```

**That's it!** The script handles everything else.

---

## Authentication Quick Guide

### API Key Only (Simplest)
```bash
curl -X POST https://unruggable.fly.dev \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getSupportedTokens"}'
```

### API Key + HMAC (Most Secure)
```bash
TIMESTAMP=$(date +%s)
BODY='{"jsonrpc":"2.0","id":1,"method":"getSupportedTokens"}'
SIGNATURE=$(echo -n "$TIMESTAMP$BODY" | openssl dgst -sha256 -hmac "YOUR_HMAC_SECRET" -hex | cut -d' ' -f2)

curl -X POST https://unruggable.fly.dev \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "x-timestamp: $TIMESTAMP" \
  -H "x-hmac-signature: $SIGNATURE" \
  -d "$BODY"
```

---

## Useful Commands

### View logs
```bash
flyctl logs -a unruggable
```

### Check status
```bash
flyctl status -a unruggable
```

### SSH into app
```bash
flyctl ssh console -a unruggable
```

### Restart app
```bash
flyctl apps restart unruggable
```

### Scale up
```bash
flyctl scale count 2 -a unruggable
```

### Update config and redeploy
```bash
# Edit kora.mainnet.toml, then:
flyctl deploy -a unruggable
```

---

## RPC Methods

### Get supported tokens
```json
{"jsonrpc":"2.0","id":1,"method":"getSupportedTokens"}
```

### Estimate fee
```json
{
  "jsonrpc":"2.0",
  "id":1,
  "method":"estimateTransactionFee",
  "params":{
    "transaction":"base64-tx",
    "paymentToken":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  }
}
```

### Sign and send
```json
{
  "jsonrpc":"2.0",
  "id":1,
  "method":"signAndSendTransaction",
  "params":{
    "transaction":"base64-tx",
    "paymentToken":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  }
}
```

### Get config
```json
{"jsonrpc":"2.0","id":1,"method":"getConfig"}
```

---

## Files

- `unruggable-feepayer.json` - Your keypair (KEEP SECURE!)
- `unruggable-credentials.txt` - API key & HMAC secret (generated on deploy)
- `kora.mainnet.toml` - Mainnet configuration
- `.env` - Environment variables (generated on deploy)

---

## Quick Troubleshooting

**Health check fails**
```bash
flyctl status -a unruggable
flyctl logs -a unruggable
```

**Need to reinitialize token accounts**
```bash
flyctl ssh console -a unruggable
kora --config kora.toml --rpc-url $RPC_URL rpc initialize-atas --signers-config signers.toml
exit
```

**Update credentials**
```bash
flyctl secrets set API_KEY="new-key" -a unruggable
flyctl secrets set HMAC_SECRET="new-secret" -a unruggable
```

---

## URLs

- **Endpoint**: https://unruggable.fly.dev
- **Health**: https://unruggable.fly.dev/liveness
- **Metrics**: https://unruggable.fly.dev/metrics
- **Fly.io Dashboard**: https://fly.io/apps/unruggable

---

**Full docs**: [MAINNET_DEPLOY.md](./MAINNET_DEPLOY.md)
