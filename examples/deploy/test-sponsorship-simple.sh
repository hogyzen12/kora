#!/bin/bash
# Simple curl-based test for Kora transaction sponsorship
# No dependencies required (just curl and jq)

set -e

ENDPOINT="https://kora-unruggable.fly.dev"
USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

echo "🧪 Testing Kora Transaction Sponsorship (Simple)"
echo "Endpoint: $ENDPOINT"
echo "============================================================"

# Step 1: Get Kora fee payer
echo ""
echo "📋 Step 1: Get Kora Fee Payer"
echo "------------------------------------------------------------"
FEE_PAYER=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getPayerSigner"
  }' | jq -r '.result.signer_address')

echo "Fee Payer: $FEE_PAYER"

# Step 2: Get recent blockhash
echo ""
echo "🔗 Step 2: Get Recent Blockhash"
echo "------------------------------------------------------------"
BLOCKHASH_RESULT=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getBlockhash"
  }')

BLOCKHASH=$(echo "$BLOCKHASH_RESULT" | jq -r '.result.blockhash')
echo "Blockhash: $BLOCKHASH"

# Step 3: Instructions for creating a test transaction
echo ""
echo "📝 Step 3: Create Test Transaction"
echo "------------------------------------------------------------"
echo "To test transaction sponsorship, you need to:"
echo ""
echo "1. Create a transaction with these 3 instructions:"
echo "   a) Assembly program (23MzuyVH6EKGbUHq7GjBY6ydSCVoZQYDmzeKVdDBKWNQ)"
echo "   b) Transfer 0.0001 SOL to juLeso (juLesoSmdTcRtzjCzYzRoHrnF8GhVu6KCV7uxq7nJGp)"
echo "   c) Transfer 0.0001 SOL to Jito (Dah1Uu7SW1da337YFRiEEyV1KAjpn7S2HwARCs216L2)"
echo ""
echo "2. Serialize the transaction to base64"
echo ""
echo "3. Test with Kora:"

# Example curl commands
echo ""
echo "============================================================"
echo "Example: Estimate Transaction Fee"
echo "============================================================"
cat << 'EOF'
curl -X POST https://kora-unruggable.fly.dev \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "estimateTransactionFee",
    "params": {
      "transaction": "YOUR_BASE64_TRANSACTION",
      "paymentToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    }
  }' | jq
EOF

echo ""
echo "============================================================"
echo "Example: Sign Transaction"
echo "============================================================"
cat << 'EOF'
curl -X POST https://kora-unruggable.fly.dev \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "signTransaction",
    "params": {
      "transaction": "YOUR_BASE64_TRANSACTION",
      "paymentToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    }
  }' | jq
EOF

echo ""
echo "============================================================"
echo "Example: Sign and Send Transaction"
echo "============================================================"
cat << 'EOF'
curl -X POST https://kora-unruggable.fly.dev \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "signAndSendTransaction",
    "params": {
      "transaction": "YOUR_BASE64_TRANSACTION",
      "paymentToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    }
  }' | jq
EOF

echo ""
echo "============================================================"
echo "💡 Recommended: Use Node.js test for full end-to-end"
echo "============================================================"
echo ""
echo "The easiest way to test is with the Node.js script:"
echo ""
echo "  npm install @solana/web3.js"
echo "  node test-sponsorship.js"
echo ""
echo "This will:"
echo "  ✅ Create a transaction with the 3 required checks"
echo "  ✅ Estimate the fee in USDC"
echo "  ✅ Sign the transaction with Kora"
echo "  ✅ Show you the cost per transaction"
echo ""
