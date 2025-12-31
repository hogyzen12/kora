#!/bin/bash
set -e

# Kora RPC Fly.io Deployment Script
# This script helps deploy Kora RPC to Fly.io

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check if flyctl is installed
check_flyctl() {
    if ! command -v flyctl &> /dev/null; then
        print_error "flyctl is not installed"
        print_info "Install it from: https://fly.io/docs/hands-on/install-flyctl/"
        exit 1
    fi
    print_success "flyctl is installed"
}

# Check if logged in to Fly.io
check_login() {
    if ! flyctl auth whoami &> /dev/null; then
        print_error "Not logged in to Fly.io"
        print_info "Running: flyctl auth login"
        flyctl auth login
    fi
    print_success "Logged in to Fly.io"
}

# Check configuration files
check_config() {
    if [ ! -f kora.toml ]; then
        print_error "kora.toml not found!"
        exit 1
    fi

    if [ ! -f signers.toml ]; then
        print_error "signers.toml not found!"
        exit 1
    fi

    if [ ! -f fly.toml ]; then
        print_error "fly.toml not found!"
        exit 1
    fi

    print_success "Configuration files found"
}

# Initialize Fly.io app
init_app() {
    local app_name="${1:-kora-rpc}"

    print_info "Initializing Fly.io app: $app_name"

    # Update app name in fly.toml
    sed -i.bak "s/^app = .*/app = \"$app_name\"/" fly.toml
    rm -f fly.toml.bak

    # Launch app (creates but doesn't deploy)
    if flyctl apps list | grep -q "$app_name"; then
        print_warning "App $app_name already exists"
    else
        flyctl apps create "$app_name"
        print_success "App $app_name created"
    fi
}

# Set secrets
set_secrets() {
    print_info "Setting secrets..."

    # Check for .env file
    if [ ! -f .env ]; then
        print_error ".env file not found!"
        print_info "Create .env file with required variables (see .env.example)"
        exit 1
    fi

    # Source .env
    set -a
    source .env
    set +a

    # Set secrets
    if [ -z "$KORA_PRIVATE_KEY" ]; then
        print_error "KORA_PRIVATE_KEY not set in .env"
        exit 1
    fi

    if [ -z "$RPC_URL" ]; then
        print_error "RPC_URL not set in .env"
        exit 1
    fi

    print_info "Setting KORA_PRIVATE_KEY..."
    echo "$KORA_PRIVATE_KEY" | flyctl secrets set KORA_PRIVATE_KEY=-

    print_info "Setting RPC_URL..."
    flyctl secrets set RPC_URL="$RPC_URL"

    # Optional secrets
    if [ -n "$API_KEY" ]; then
        print_info "Setting API_KEY..."
        flyctl secrets set API_KEY="$API_KEY"
    fi

    if [ -n "$HMAC_SECRET" ]; then
        print_info "Setting HMAC_SECRET..."
        flyctl secrets set HMAC_SECRET="$HMAC_SECRET"
    fi

    print_success "Secrets configured"
}

# Deploy to Fly.io
deploy() {
    print_info "Deploying to Fly.io..."

    # Deploy the app
    flyctl deploy --remote-only --ha=false

    print_success "Deployment complete!"
    print_info "App URL: https://$(flyctl info --json | jq -r '.Hostname')"
}

# Full setup (init + secrets + deploy)
full_setup() {
    local app_name="${1:-kora-rpc}"

    print_info "Starting full Fly.io setup for: $app_name"

    check_flyctl
    check_login
    check_config
    init_app "$app_name"
    set_secrets
    deploy

    print_success "Kora RPC is now live on Fly.io!"
    print_info "View logs: flyctl logs"
    print_info "Check status: flyctl status"
    print_info "Scale up: flyctl scale count 2"
}

# View logs
view_logs() {
    flyctl logs
}

# Check status
check_status() {
    flyctl status
}

# Scale app
scale_app() {
    local count="${1:-1}"
    print_info "Scaling to $count instances..."
    flyctl scale count "$count"
    print_success "Scaled to $count instances"
}

# Update configuration
update_config() {
    print_info "Updating configuration..."

    # Re-deploy with latest config
    flyctl deploy --remote-only

    print_success "Configuration updated"
}

# Open app in browser
open_app() {
    flyctl open
}

# SSH into app
ssh_app() {
    flyctl ssh console
}

# Destroy app
destroy_app() {
    local app_name="${1}"

    if [ -z "$app_name" ]; then
        print_error "App name required"
        print_info "Usage: $0 destroy <app-name>"
        exit 1
    fi

    print_warning "This will permanently delete the app: $app_name"
    read -p "Are you sure? (yes/no): " -r
    if [ "$REPLY" != "yes" ]; then
        print_info "Cancelled"
        exit 0
    fi

    flyctl apps destroy "$app_name" --yes

    print_success "App $app_name destroyed"
}

# Show usage
usage() {
    cat <<EOF
Kora RPC Fly.io Deployment Script

Usage: $0 <command> [options]

Commands:
    init [app-name]     Initialize Fly.io app (default: kora-rpc)
    secrets             Set secrets from .env file
    deploy              Deploy to Fly.io
    setup [app-name]    Full setup: init + secrets + deploy
    logs                View logs
    status              Check app status
    scale <count>       Scale to <count> instances
    update              Update configuration
    open                Open app in browser
    ssh                 SSH into app
    destroy <app-name>  Destroy app permanently
    help                Show this help message

Examples:
    # Full setup
    $0 setup my-kora-rpc

    # Update existing deployment
    $0 deploy

    # View logs
    $0 logs

    # Scale to 3 instances
    $0 scale 3

    # Destroy app
    $0 destroy my-kora-rpc

Before deploying:
1. Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
2. Login: flyctl auth login
3. Create .env file with your configuration
4. Edit fly.toml with your preferred region

EOF
}

# Main script
case "${1:-}" in
    init)
        check_flyctl
        check_login
        check_config
        init_app "${2:-kora-rpc}"
        ;;
    secrets)
        check_flyctl
        check_login
        set_secrets
        ;;
    deploy)
        check_flyctl
        check_login
        check_config
        deploy
        ;;
    setup)
        full_setup "${2:-kora-rpc}"
        ;;
    logs)
        check_flyctl
        view_logs
        ;;
    status)
        check_flyctl
        check_status
        ;;
    scale)
        check_flyctl
        scale_app "$2"
        ;;
    update)
        check_flyctl
        update_config
        ;;
    open)
        check_flyctl
        open_app
        ;;
    ssh)
        check_flyctl
        ssh_app
        ;;
    destroy)
        check_flyctl
        destroy_app "$2"
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        print_error "Unknown command: ${1:-}"
        echo
        usage
        exit 1
        ;;
esac
