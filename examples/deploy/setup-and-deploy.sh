#!/bin/bash
set -e

echo "🚀 Kora RPC Deployment Setup"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Check if keypair exists
if [ ! -f kora-feepayer.json ]; then
    echo "❌ kora-feepayer.json not found!"
    echo ""
    echo "Creating a test keypair for devnet..."
    cat > kora-feepayer.json << 'EOF'
[176,196,223,60,125,21,145,127,72,144,168,102,205,95,50,164,8,132,24,115,209,129,86,132,74,189,206,73,52,147,134,158,186,75,162,228,92,208,210,233,83,165,222,148,28,243,73,231,145,240,203,24,23,77,48,211,177,164,232,163,28,81,175,140]
EOF
    echo -e "${GREEN}✓${NC} Test keypair created"
fi

# Step 2: Read keypair and update .env
echo ""
echo "📝 Configuring environment..."
KEYPAIR_CONTENT=$(cat kora-feepayer.json)

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
fi

# Update KORA_PRIVATE_KEY in .env
if grep -q "KORA_PRIVATE_KEY=PLACEHOLDER_WILL_BE_REPLACED" .env; then
    # Use a temporary file for sed
    sed "s|KORA_PRIVATE_KEY=.*|KORA_PRIVATE_KEY='$KEYPAIR_CONTENT'|" .env > .env.tmp && mv .env.tmp .env
    echo -e "${GREEN}✓${NC} Environment configured"
else
    echo -e "${YELLOW}⚠${NC}  KORA_PRIVATE_KEY already set in .env"
fi

# Step 3: Show current config
echo ""
echo "📋 Current Configuration:"
echo "------------------------"
echo "RPC URL: $(grep RPC_URL .env | cut -d '=' -f2)"
echo "Port: $(grep ^PORT .env | cut -d '=' -f2)"
echo "API Key: $(grep ^API_KEY .env | cut -d '=' -f2)"
echo ""

# Step 4: Check if Fly.io CLI is in PATH
export PATH="/root/.fly/bin:$PATH"
if ! command -v flyctl &> /dev/null; then
    echo "❌ Fly.io CLI not found in PATH"
    echo "Run: export PATH=\"/root/.fly/bin:\$PATH\""
    exit 1
fi

echo -e "${GREEN}✓${NC} Fly.io CLI found"
echo ""

# Step 5: Prompt for app name
read -p "Enter your Fly.io app name (e.g., my-kora-rpc): " APP_NAME
APP_NAME=${APP_NAME:-my-kora-rpc}

echo ""
echo "🎯 Ready to deploy!"
echo "App name: $APP_NAME"
echo ""
read -p "Press Enter to start deployment, or Ctrl+C to cancel..."

# Step 6: Login to Fly.io
echo ""
echo "🔐 Logging into Fly.io..."
echo "A browser window will open. Please login to continue."
flyctl auth login

# Step 7: Deploy!
echo ""
echo "🚀 Deploying to Fly.io..."
./deploy-fly.sh setup "$APP_NAME"

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Your Kora RPC endpoint: https://$APP_NAME.fly.dev"
echo ""
echo "Next steps:"
echo "1. Test: curl https://$APP_NAME.fly.dev/liveness"
echo "2. Initialize token accounts (see DEPLOY_NOW.md Step 8)"
echo "3. Start using your Kora RPC node!"
