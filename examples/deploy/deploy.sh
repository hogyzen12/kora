#!/bin/bash
set -e

# Kora RPC Deployment Helper Script
# This script helps you deploy and manage your Kora RPC node

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
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

# Check if .env file exists
check_env_file() {
    if [ ! -f .env ]; then
        print_error ".env file not found!"
        print_info "Creating .env from .env.example..."
        cp .env.example .env
        print_warning "Please edit .env file with your configuration before continuing"
        exit 1
    fi
}

# Check if config files exist
check_config_files() {
    if [ ! -f kora.toml ]; then
        print_error "kora.toml not found!"
        exit 1
    fi

    if [ ! -f signers.toml ]; then
        print_error "signers.toml not found!"
        exit 1
    fi

    print_success "Configuration files found"
}

# Validate configuration
validate_config() {
    print_info "Validating configuration..."

    # Check if kora CLI is installed
    if ! command -v kora &> /dev/null; then
        print_warning "kora CLI not found. Installing from crates.io..."
        cargo install kora-cli
    fi

    # Source environment variables
    set -a
    source .env
    set +a

    # Validate configuration
    if kora --config kora.toml config validate; then
        print_success "Configuration is valid"
    else
        print_error "Configuration validation failed"
        exit 1
    fi
}

# Deploy with Docker
deploy_docker() {
    print_info "Deploying Kora RPC with Docker..."

    check_env_file
    check_config_files

    # Build and start services
    docker-compose up -d --build

    print_success "Kora RPC deployed successfully"
    print_info "View logs: docker-compose logs -f kora"
    print_info "Health check: curl http://localhost:${PORT:-8080}/liveness"
}

# Deploy with Docker + Monitoring
deploy_with_monitoring() {
    print_info "Deploying Kora RPC with monitoring stack..."

    check_env_file
    check_config_files

    # Start services with monitoring profile
    docker-compose --profile monitoring up -d --build

    print_success "Kora RPC and monitoring stack deployed successfully"
    print_info "Kora RPC: http://localhost:${PORT:-8080}"
    print_info "Prometheus: http://localhost:9090"
    print_info "Grafana: http://localhost:3000 (admin/admin)"
}

# Stop services
stop_services() {
    print_info "Stopping Kora RPC services..."
    docker-compose down
    print_success "Services stopped"
}

# View logs
view_logs() {
    docker-compose logs -f kora
}

# Health check
health_check() {
    print_info "Checking Kora RPC health..."

    # Source environment variables
    set -a
    source .env 2>/dev/null || true
    set +a

    local port="${PORT:-8080}"
    local response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/liveness 2>/dev/null || echo "000")

    if [ "$response" = "200" ]; then
        print_success "Kora RPC is healthy (HTTP $response)"
    else
        print_error "Kora RPC is unhealthy (HTTP $response)"
        exit 1
    fi
}

# Initialize ATAs (Associated Token Accounts)
initialize_atas() {
    print_info "Initializing Associated Token Accounts..."

    check_env_file
    check_config_files

    # Source environment variables
    set -a
    source .env
    set +a

    if [ -z "$RPC_URL" ]; then
        print_error "RPC_URL not set in .env"
        exit 1
    fi

    kora --config kora.toml --rpc-url "$RPC_URL" rpc initialize-atas --signers-config signers.toml

    print_success "ATAs initialized successfully"
}

# Generate keypair
generate_keypair() {
    print_info "Generating new Solana keypair..."

    local output_file="${1:-keypair.json}"

    if [ -f "$output_file" ]; then
        print_warning "File $output_file already exists!"
        read -p "Overwrite? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Cancelled"
            exit 0
        fi
    fi

    solana-keygen new -o "$output_file" --no-bip39-passphrase

    print_success "Keypair generated: $output_file"
    print_info "Public key: $(solana-keygen pubkey $output_file)"
    print_warning "Keep this file secure! It contains your private key."
}

# Test RPC methods
test_rpc() {
    print_info "Testing RPC methods..."

    # Source environment variables
    set -a
    source .env 2>/dev/null || true
    set +a

    local port="${PORT:-8080}"
    local api_key="${API_KEY:-}"
    local headers=""

    if [ -n "$api_key" ]; then
        headers="-H 'x-api-key: $api_key'"
    fi

    # Test liveness
    print_info "Testing /liveness endpoint..."
    if curl -s http://localhost:$port/liveness | jq .; then
        print_success "Liveness endpoint working"
    else
        print_error "Liveness endpoint failed"
    fi

    # Test getSupportedTokens
    print_info "Testing getSupportedTokens method..."
    if curl -s -X POST http://localhost:$port \
        -H "Content-Type: application/json" \
        $headers \
        -d '{"jsonrpc":"2.0","id":1,"method":"getSupportedTokens"}' | jq .; then
        print_success "getSupportedTokens method working"
    else
        print_error "getSupportedTokens method failed"
    fi

    # Test getConfig
    print_info "Testing getConfig method..."
    if curl -s -X POST http://localhost:$port \
        -H "Content-Type: application/json" \
        $headers \
        -d '{"jsonrpc":"2.0","id":1,"method":"getConfig"}' | jq .; then
        print_success "getConfig method working"
    else
        print_error "getConfig method failed"
    fi
}

# Show usage
usage() {
    cat <<EOF
Kora RPC Deployment Helper

Usage: $0 <command> [options]

Commands:
    setup               Set up .env file from template
    validate            Validate kora.toml configuration
    deploy              Deploy with Docker (basic)
    deploy-monitoring   Deploy with Docker + monitoring stack
    stop                Stop all services
    restart             Restart all services
    logs                View logs
    health              Check health status
    init-atas           Initialize Associated Token Accounts
    generate-keypair    Generate new Solana keypair
    test                Test RPC methods
    help                Show this help message

Examples:
    $0 setup
    $0 validate
    $0 deploy
    $0 deploy-monitoring
    $0 logs
    $0 health
    $0 init-atas
    $0 generate-keypair my-keypair.json
    $0 test

EOF
}

# Main script
case "${1:-}" in
    setup)
        if [ ! -f .env ]; then
            cp .env.example .env
            print_success "Created .env file from template"
            print_warning "Please edit .env file with your configuration"
        else
            print_warning ".env file already exists"
        fi
        ;;
    validate)
        validate_config
        ;;
    deploy)
        deploy_docker
        ;;
    deploy-monitoring)
        deploy_with_monitoring
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        deploy_docker
        ;;
    logs)
        view_logs
        ;;
    health)
        health_check
        ;;
    init-atas)
        initialize_atas
        ;;
    generate-keypair)
        generate_keypair "$2"
        ;;
    test)
        test_rpc
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
