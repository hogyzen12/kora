#!/bin/bash
# Simple curl-based tests for Kora RPC API

ENDPOINT="https://kora-unruggable.fly.dev"

echo "🚀 Testing Kora RPC API"
echo "Endpoint: $ENDPOINT"
echo "============================================================"

# Test 1: Liveness check
echo ""
echo "🧪 Test 1: Liveness Check"
echo "============================================================"
curl -s "$ENDPOINT/liveness" | jq .
if [ $? -eq 0 ]; then
  echo "✅ Liveness check passed"
else
  echo "❌ Liveness check failed"
fi

# Test 2: Get supported tokens
echo ""
echo "🧪 Test 2: getSupportedTokens"
echo "============================================================"
TOKENS=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getSupportedTokens"
  }')

echo "$TOKENS" | jq .
if echo "$TOKENS" | jq -e '.result' > /dev/null 2>&1; then
  echo "✅ getSupportedTokens passed"
else
  echo "❌ getSupportedTokens failed"
fi

# Test 3: Get payer signer
echo ""
echo "🧪 Test 3: getPayerSigner"
echo "============================================================"
PAYER=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getPayerSigner"
  }')

echo "$PAYER" | jq .
FEE_PAYER=$(echo "$PAYER" | jq -r '.result.signer_address // .result.payer')
if [ "$FEE_PAYER" != "null" ] && [ -n "$FEE_PAYER" ]; then
  echo "✅ getPayerSigner passed - Fee Payer: $FEE_PAYER"
else
  echo "❌ getPayerSigner failed"
  FEE_PAYER="KoRaXJTbWuDNgCFdhu6dygok5Fh1dcQB6iLxuDNLoiN"  # fallback
fi

# Test 4: Check fee payer balance
echo ""
echo "🧪 Test 4: Fee Payer SOL Balance"
echo "============================================================"
BALANCE=$(curl -s -X POST "https://api.mainnet-beta.solana.com" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"getBalance\",
    \"params\": [\"$FEE_PAYER\"]
  }")

echo "$BALANCE" | jq .
LAMPORTS=$(echo "$BALANCE" | jq -r '.result.value')
SOL=$(echo "scale=9; $LAMPORTS / 1000000000" | bc)
echo "Fee Payer Balance: $SOL SOL ($LAMPORTS lamports)"

if (( $(echo "$SOL > 0.01" | bc -l) )); then
  echo "✅ Fee payer has sufficient balance"
else
  echo "⚠️  Fee payer balance is low - consider funding with more SOL"
fi

# Test 5: Get config
echo ""
echo "🧪 Test 5: getConfig"
echo "============================================================"
CONFIG=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getConfig"
  }')

echo "$CONFIG" | jq .
if echo "$CONFIG" | jq -e '.result' > /dev/null 2>&1; then
  echo "✅ getConfig passed"
else
  echo "❌ getConfig failed"
fi

# Summary
echo ""
echo "============================================================"
echo "✅ Basic API tests completed!"
echo "============================================================"
echo ""
echo "💡 Next steps:"
echo "   1. Test estimateTransactionFee with a real transaction"
echo "   2. Test signAndSendTransaction with your app's format"
echo "   3. Verify the 3 required checks (Assembly, juLeso, Jito)"
echo "   4. Enable authentication before production use"
echo ""
echo "📊 Current Status:"
echo "   - Endpoint: $ENDPOINT"
echo "   - Fee Payer: $FEE_PAYER"
echo "   - Balance: $SOL SOL"
echo "   - Authentication: ❌ DISABLED (test mode)"
echo ""
