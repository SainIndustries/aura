#!/bin/bash
#
# build-snapshot.sh - Create a pre-baked Hetzner snapshot for Aura agents
#
# This script creates a temporary VM, installs all required software,
# hardens security, creates a snapshot, and cleans up.
#
# Prerequisites:
#   - HETZNER_API_TOKEN environment variable
#   - HETZNER_SSH_KEY_ID environment variable
#   - SSH key available for connection
#
# Usage:
#   ./build-snapshot.sh
#
# Output:
#   Snapshot ID (to be used as HETZNER_SNAPSHOT_ID)
#

set -euo pipefail

# Configuration
TEMP_SERVER_NAME="snapshot-builder-$(date +%Y%m%d%H%M%S)"
SERVER_TYPE="cpx11"
BASE_IMAGE="ubuntu-22.04"
LOCATION="nbg1"
SNAPSHOT_NAME="aura-base-$(date +%Y%m%d)"
SSH_USER="root"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Validate environment
validate_env() {
    if [[ -z "${HETZNER_API_TOKEN:-}" ]]; then
        log_error "HETZNER_API_TOKEN environment variable is required"
        exit 1
    fi

    if [[ -z "${HETZNER_SSH_KEY_ID:-}" ]]; then
        log_error "HETZNER_SSH_KEY_ID environment variable is required"
        exit 1
    fi

    if [[ -z "${SSH_PRIVATE_KEY_PATH:-}" ]]; then
        # Try default locations
        if [[ -f "$HOME/.ssh/id_rsa" ]]; then
            SSH_PRIVATE_KEY_PATH="$HOME/.ssh/id_rsa"
        elif [[ -f "$HOME/.ssh/id_ed25519" ]]; then
            SSH_PRIVATE_KEY_PATH="$HOME/.ssh/id_ed25519"
        else
            log_error "SSH_PRIVATE_KEY_PATH not set and no default key found"
            exit 1
        fi
    fi

    log_info "Using SSH key: $SSH_PRIVATE_KEY_PATH"
}

# Hetzner API helper
hetzner_api() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"

    local args=(-s -X "$method" -H "Authorization: Bearer $HETZNER_API_TOKEN" -H "Content-Type: application/json")
    
    if [[ -n "$data" ]]; then
        args+=(-d "$data")
    fi

    curl "${args[@]}" "https://api.hetzner.cloud/v1$endpoint"
}

# Wait for Hetzner action to complete
wait_for_action() {
    local action_id="$1"
    local max_attempts=120
    local attempt=0

    log_info "Waiting for action $action_id to complete..."

    while [[ $attempt -lt $max_attempts ]]; do
        local status
        status=$(hetzner_api GET "/actions/$action_id" | jq -r '.action.status')

        if [[ "$status" == "success" ]]; then
            log_success "Action $action_id completed"
            return 0
        elif [[ "$status" == "error" ]]; then
            log_error "Action $action_id failed"
            return 1
        fi

        sleep 1
        ((attempt++))
    done

    log_error "Action $action_id timed out"
    return 1
}

# Create temporary server
create_temp_server() {
    log_info "Creating temporary server: $TEMP_SERVER_NAME"

    local response
    response=$(hetzner_api POST "/servers" "{
        \"name\": \"$TEMP_SERVER_NAME\",
        \"server_type\": \"$SERVER_TYPE\",
        \"image\": \"$BASE_IMAGE\",
        \"location\": \"$LOCATION\",
        \"ssh_keys\": [$HETZNER_SSH_KEY_ID],
        \"start_after_create\": true,
        \"labels\": {
            \"purpose\": \"snapshot-builder\",
            \"temporary\": \"true\"
        }
    }")

    SERVER_ID=$(echo "$response" | jq -r '.server.id')
    SERVER_IP=$(echo "$response" | jq -r '.server.public_net.ipv4.ip')
    ACTION_ID=$(echo "$response" | jq -r '.action.id')

    if [[ "$SERVER_ID" == "null" ]] || [[ -z "$SERVER_ID" ]]; then
        log_error "Failed to create server: $(echo "$response" | jq -r '.error.message // "Unknown error"')"
        exit 1
    fi

    log_success "Server created: ID=$SERVER_ID, IP=$SERVER_IP"
    wait_for_action "$ACTION_ID"
}

# Wait for SSH to be available
wait_for_ssh() {
    log_info "Waiting for SSH to be available..."
    
    local max_attempts=60
    local attempt=0

    while [[ $attempt -lt $max_attempts ]]; do
        if ssh $SSH_OPTS -i "$SSH_PRIVATE_KEY_PATH" -o ConnectTimeout=5 "$SSH_USER@$SERVER_IP" "echo 'SSH ready'" &>/dev/null; then
            log_success "SSH is available"
            return 0
        fi
        sleep 2
        ((attempt++))
    done

    log_error "SSH connection timed out"
    return 1
}

# Run commands on the server
run_ssh() {
    ssh $SSH_OPTS -i "$SSH_PRIVATE_KEY_PATH" "$SSH_USER@$SERVER_IP" "$@"
}

# Configure the server
configure_server() {
    log_info "Configuring server..."

    # Wait for cloud-init to finish
    log_info "Waiting for cloud-init to complete..."
    run_ssh "cloud-init status --wait" || true

    # Update and install packages
    log_info "Updating packages and installing dependencies..."
    run_ssh "export DEBIAN_FRONTEND=noninteractive && \
        apt-get update && \
        apt-get upgrade -y && \
        apt-get install -y \
            apt-transport-https \
            ca-certificates \
            curl \
            gnupg \
            lsb-release \
            jq \
            fail2ban \
            ufw"

    # Install Docker
    log_info "Installing Docker..."
    run_ssh "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg && \
        echo 'deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu jammy stable' > /etc/apt/sources.list.d/docker.list && \
        apt-get update && \
        apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin && \
        systemctl enable docker"

    # Install Node.js 20
    log_info "Installing Node.js 20..."
    run_ssh "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
        apt-get install -y nodejs"

    # Install Tailscale
    log_info "Installing Tailscale..."
    run_ssh "curl -fsSL https://tailscale.com/install.sh | sh"

    # Create openclaw user
    log_info "Creating openclaw user..."
    run_ssh "useradd --system --shell /usr/sbin/nologin --home-dir /opt/openclaw --create-home openclaw && \
        usermod -aG docker openclaw"

    # Create directory structure
    log_info "Creating directory structure..."
    run_ssh "mkdir -p /opt/openclaw/{config,agent,logs} && \
        chown -R openclaw:openclaw /opt/openclaw && \
        chmod 755 /opt/openclaw && \
        chmod 700 /opt/openclaw/config"

    # Create systemd service template
    log_info "Creating systemd service..."
    run_ssh "cat > /etc/systemd/system/openclaw-agent.service << 'EOF'
[Unit]
Description=OpenClaw Agent Service
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
User=openclaw
EnvironmentFile=/opt/openclaw/config/agent.env
ExecStart=/usr/bin/node /opt/openclaw/agent/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=openclaw-agent

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload"

    # Configure UFW
    log_info "Configuring UFW firewall..."
    run_ssh "ufw default deny incoming && \
        ufw default allow outgoing && \
        ufw allow 22/tcp && \
        ufw allow 41641/udp && \
        echo 'y' | ufw enable"

    # Configure fail2ban
    log_info "Configuring fail2ban..."
    run_ssh "cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF
    systemctl enable fail2ban && \
    systemctl restart fail2ban"

    # Cleanup
    log_info "Cleaning up..."
    run_ssh "apt-get clean && \
        apt-get autoremove -y && \
        rm -rf /var/lib/apt/lists/* && \
        rm -rf /tmp/* && \
        rm -rf /var/tmp/* && \
        truncate -s 0 /var/log/*.log && \
        truncate -s 0 /var/log/**/*.log 2>/dev/null || true && \
        history -c && \
        rm -f /root/.bash_history"

    log_success "Server configuration complete"
}

# Power off the server
power_off_server() {
    log_info "Powering off server for snapshot..."

    local response
    response=$(hetzner_api POST "/servers/$SERVER_ID/actions/shutdown" "{}")
    
    local action_id
    action_id=$(echo "$response" | jq -r '.action.id')

    if [[ "$action_id" != "null" ]]; then
        wait_for_action "$action_id" || {
            log_warn "Graceful shutdown timeout, forcing power off..."
            response=$(hetzner_api POST "/servers/$SERVER_ID/actions/poweroff" "{}")
            action_id=$(echo "$response" | jq -r '.action.id')
            wait_for_action "$action_id"
        }
    fi

    log_success "Server powered off"
}

# Create snapshot
create_snapshot() {
    log_info "Creating snapshot: $SNAPSHOT_NAME"

    local response
    response=$(hetzner_api POST "/servers/$SERVER_ID/actions/create_image" "{
        \"description\": \"Aura base image with Docker, Node.js 20, fail2ban, UFW, and openclaw user\",
        \"type\": \"snapshot\",
        \"labels\": {
            \"purpose\": \"aura-agent-base\",
            \"created\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }
    }")

    local action_id
    action_id=$(echo "$response" | jq -r '.action.id')
    SNAPSHOT_ID=$(echo "$response" | jq -r '.image.id')

    if [[ "$SNAPSHOT_ID" == "null" ]] || [[ -z "$SNAPSHOT_ID" ]]; then
        log_error "Failed to create snapshot: $(echo "$response" | jq -r '.error.message // "Unknown error"')"
        return 1
    fi

    log_info "Snapshot creation started: ID=$SNAPSHOT_ID"
    wait_for_action "$action_id"

    # Rename snapshot with proper name
    hetzner_api PUT "/images/$SNAPSHOT_ID" "{\"description\": \"$SNAPSHOT_NAME\", \"labels\": {\"name\": \"$SNAPSHOT_NAME\", \"purpose\": \"aura-agent-base\"}}" > /dev/null

    log_success "Snapshot created: $SNAPSHOT_ID"
}

# Delete temporary server
delete_temp_server() {
    log_info "Deleting temporary server..."

    local response
    response=$(hetzner_api DELETE "/servers/$SERVER_ID")

    log_success "Temporary server deleted"
}

# Cleanup on exit
cleanup() {
    if [[ -n "${SERVER_ID:-}" ]]; then
        log_warn "Cleaning up temporary server $SERVER_ID..."
        hetzner_api DELETE "/servers/$SERVER_ID" &>/dev/null || true
    fi
}

# Main execution
main() {
    echo "========================================"
    echo "  Aura Snapshot Builder"
    echo "========================================"
    echo ""

    trap cleanup EXIT

    validate_env
    create_temp_server
    wait_for_ssh
    configure_server
    power_off_server
    create_snapshot
    
    # Disable cleanup trap since we'll delete explicitly
    trap - EXIT
    delete_temp_server

    echo ""
    echo "========================================"
    echo -e "${GREEN}Snapshot created successfully!${NC}"
    echo "========================================"
    echo ""
    echo "Snapshot ID: $SNAPSHOT_ID"
    echo "Snapshot Name: $SNAPSHOT_NAME"
    echo ""
    echo "To use this snapshot, set:"
    echo "  export HETZNER_SNAPSHOT_ID=$SNAPSHOT_ID"
    echo ""
    echo "Or add to your .env file:"
    echo "  HETZNER_SNAPSHOT_ID=$SNAPSHOT_ID"
    echo ""

    # Output for CI/CD
    echo "::set-output name=snapshot_id::$SNAPSHOT_ID"
    echo "::set-output name=snapshot_name::$SNAPSHOT_NAME"
    
    # Also write to GITHUB_OUTPUT for modern Actions
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
        echo "snapshot_id=$SNAPSHOT_ID" >> "$GITHUB_OUTPUT"
        echo "snapshot_name=$SNAPSHOT_NAME" >> "$GITHUB_OUTPUT"
    fi
}

main "$@"
