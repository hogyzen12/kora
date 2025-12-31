#!/bin/bash
set -e

echo "🚀 Deploying Kora RPC: UNRUGGABLE (Mainnet)"
echo "==========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_NAME="unruggable"

# Step 1: Check if keypair exists
if [ ! -f unruggable-feepayer.json ]; then
    echo -e "${RED}❌ unruggable-feepayer.json not found!${NC}"
    echo ""
    echo "You need to provide your mainnet keypair."
    echo ""
    echo "Please do ONE of the following:"
    echo ""
    echo "Option 1 - Copy your existing keypair:"
    echo "  cp /path/to/your/mainnet-keypair.json unruggable-feepayer.json"
    echo ""
    echo "Option 2 - Create from array format:"
    echo "  cat > unruggable-feepayer.json << 'EOF'"
    echo "  [your,private,key,bytes,here...]"
    echo "  EOF"
    echo ""
    echo "Option 3 - I can help you convert base58 to JSON format"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} Found keypair: unruggable-feepayer.json"
echo ""

# Step 2: Generate secure authentication keys
echo "🔐 Generating secure authentication keys..."
echo ""

# Check if openssl is available
if command -v openssl &> /dev/null; then
    API_KEY=$(openssl rand -base64 32 | tr -d '\n')
    HMAC_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    echo -e "${GREEN}✓${NC} Generated secure API key and HMAC secret"
else
    # Fallback to random hex
    API_KEY=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 43 | head -n 1)
    HMAC_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 86 | head -n 1)
    echo -e "${YELLOW}⚠${NC}  Generated keys using fallback method (openssl not found)"
fi

echo ""
echo "📋 Your Authentication Credentials:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}API Key:${NC}     $API_KEY"
echo -e "${GREEN}HMAC Secret:${NC} $HMAC_SECRET"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}⚠ SAVE THESE CREDENTIALS!${NC} You'll need them to make API calls."
echo ""

# Step 3: Ask for RPC URL
echo "🌐 Solana RPC Configuration"
echo ""
echo "For mainnet production, you should use a reliable RPC provider:"
echo "  1. Helius (https://helius.dev)"
echo "  2. QuickNode (https://quicknode.com)"
echo "  3. Triton (https://triton.one)"
echo "  4. Alchemy (https://alchemy.com)"
echo "  5. Public endpoint (free but rate-limited)"
echo ""
read -p "Enter your RPC URL [https://api.mainnet-beta.solana.com]: " RPC_URL
RPC_URL=${RPC_URL:-https://api.mainnet-beta.solana.com}

echo ""
echo -e "${GREEN}✓${NC} RPC URL: $RPC_URL"

# Step 4: Create .env file
echo ""
echo "📝 Creating environment configuration..."

KEYPAIR_CONTENT=$(cat unruggable-feepayer.json)

cat > .env << EOF
# Kora RPC - UNRUGGABLE (Mainnet)
# Generated: $(date)

# ====================
# Required Configuration
# ====================

RPC_URL=$RPC_URL
KORA_PRIVATE_KEY='$KEYPAIR_CONTENT'
PORT=8080
RUST_LOG=info

# ====================
# Authentication
# ====================

API_KEY=$API_KEY
HMAC_SECRET=$HMAC_SECRET
EOF

echo -e "${GREEN}✓${NC} Environment configured (.env created)"

# Step 5: Copy mainnet config
echo ""
echo "📄 Setting up mainnet configuration..."
if [ -f kora.mainnet.toml ]; then
    cp kora.mainnet.toml kora.toml
    echo -e "${GREEN}✓${NC} Using mainnet configuration"
else
    echo -e "${YELLOW}⚠${NC}  kora.mainnet.toml not found, using default kora.toml"
fi

# Step 6: Verify Fly.io CLI
export PATH="/root/.fly/bin:$PATH"
if ! command -v flyctl &> /dev/null; then
    echo -e "${RED}❌ Fly.io CLI not found${NC}"
    echo "Run: export PATH=\"/root/.fly/bin:\$PATH\""
    exit 1
fi

# Step 7: Confirm deployment
echo ""
echo "🎯 Ready to Deploy!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "App Name:    $APP_NAME"
echo "Network:     Mainnet"
echo "RPC URL:     $RPC_URL"
echo "Auth:        API Key + HMAC (enabled)"
echo "Endpoint:    https://$APP_NAME.fly.dev"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}⚠ IMPORTANT:${NC}"
echo "1. Your fee payer needs SOL for transaction fees"
echo "2. Save your API_KEY and HMAC_SECRET (shown above)"
echo "3. You'll need to initialize token accounts after deployment"
echo ""
read -p "Continue with deployment? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

# Step 8: Login to Fly.io
echo ""
echo "🔐 Logging into Fly.io..."
flyctl auth login

# Step 9: Initialize app if it doesn't exist
echo ""
echo "🏗️  Initializing Fly.io app: $APP_NAME"

if flyctl apps list 2>/dev/null | grep -q "^$APP_NAME"; then
    echo -e "${YELLOW}⚠${NC}  App '$APP_NAME' already exists"
else
    flyctl apps create "$APP_NAME"
    echo -e "${GREEN}✓${NC} App created: $APP_NAME"
fi

# Step 10: Update fly.toml
if [ -f fly.toml ]; then
    sed -i.bak "s/^app = .*/app = \"$APP_NAME\"/" fly.toml
    rm -f fly.toml.bak
    echo -e "${GREEN}✓${NC} Updated fly.toml"
fi

# Step 11: Set secrets
echo ""
echo "🔒 Setting secrets in Fly.io..."

echo "$KEYPAIR_CONTENT" | flyctl secrets set KORA_PRIVATE_KEY=- -a "$APP_NAME"
flyctl secrets set RPC_URL="$RPC_URL" -a "$APP_NAME"
flyctl secrets set API_KEY="$API_KEY" -a "$APP_NAME"
flyctl secrets set HMAC_SECRET="$HMAC_SECRET" -a "$APP_NAME"

echo -e "${GREEN}✓${NC} Secrets configured"

# Step 12: Deploy!
echo ""
echo "🚀 Deploying to Fly.io..."
flyctl deploy --remote-only --ha=false -a "$APP_NAME"

echo ""
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Your Kora RPC is live!"
echo ""
echo "Endpoint: https://$APP_NAME.fly.dev"
echo ""
echo "🔐 Authentication Credentials (SAVE THESE):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "API Key:     $API_KEY"
echo "HMAC Secret: $HMAC_SECRET"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Next Steps:"
echo ""
echo "1. Test health check:"
echo "   curl https://$APP_NAME.fly.dev/liveness"
echo ""
echo "2. Initialize token accounts (REQUIRED):"
echo "   flyctl ssh console -a $APP_NAME"
echo "   kora --config kora.toml --rpc-url \$RPC_URL rpc initialize-atas --signers-config signers.toml"
echo "   exit"
echo ""
echo "3. Test with authentication:"
echo "   curl -X POST https://$APP_NAME.fly.dev \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H 'x-api-key: $API_KEY' \\"
echo "     -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getSupportedTokens\"}'"
echo ""
echo "4. Monitor logs:"
echo "   flyctl logs -a $APP_NAME"
echo ""
echo "5. Check status:"
echo "   flyctl status -a $APP_NAME"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Save credentials to file
cat > unruggable-credentials.txt << EOF
Kora RPC: UNRUGGABLE
Deployed: $(date)

Endpoint: https://$APP_NAME.fly.dev
Network: Mainnet
RPC URL: $RPC_URL

Authentication Credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
API Key:     $API_KEY
HMAC Secret: $HMAC_SECRET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KEEP THIS FILE SECURE!
EOF

echo -e "${GREEN}✓${NC} Credentials saved to: unruggable-credentials.txt"
echo ""
echo "🎊 Happy sponsoring!"
