#!/usr/bin/env bash
# One-time Cloudflare Tunnel setup for ArcFlow (Docker-based).
#
# The tunnel runs as the `cloudflared` service in docker-compose.yml using
# deploy/cloudflared/config.yml as its single source of truth. This script only
# prepares the tunnel + DNS on Cloudflare's side; it does NOT render a host
# config or install a launchd/systemd service anymore.
#
# Prereq: run `cloudflared tunnel login` first (interactive — picks the
# arcflow.click zone). That writes ~/.cloudflared/cert.pem.
set -euo pipefail

TUNNEL_NAME="arcflow"
CF_DIR="$HOME/.cloudflared"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG="$SCRIPT_DIR/cloudflared/config.yml"

if [ ! -f "$CF_DIR/cert.pem" ]; then
  echo "ERROR: not logged in. Run:  cloudflared tunnel login" >&2
  exit 1
fi

# Create the tunnel if it doesn't exist yet.
if ! cloudflared tunnel list | awk '{print $2}' | grep -qx "$TUNNEL_NAME"; then
  echo ">> Creating tunnel '$TUNNEL_NAME'..."
  cloudflared tunnel create "$TUNNEL_NAME"
else
  echo ">> Tunnel '$TUNNEL_NAME' already exists."
fi

# Resolve tunnel ID (UUID) by name.
TUNNEL_ID="$(cloudflared tunnel list | awk -v n="$TUNNEL_NAME" '$2==n {print $1}')"
if [ -z "${TUNNEL_ID:-}" ]; then
  echo "ERROR: could not resolve tunnel id for '$TUNNEL_NAME'." >&2
  exit 1
fi
CRED_FILE="$CF_DIR/$TUNNEL_ID.json"
echo ">> Tunnel ID:    $TUNNEL_ID"
echo ">> Credentials:  $CRED_FILE"

if [ ! -f "$CRED_FILE" ]; then
  echo "ERROR: credentials file missing: $CRED_FILE" >&2
  echo "       (re-create the tunnel or copy the JSON from the machine that created it)" >&2
  exit 1
fi

# config.yml and docker-compose.yml both pin this tunnel ID. If a *new* tunnel
# was just created, those files won't match — flag it instead of silently
# tunnelling to the wrong UUID.
if ! grep -q "$TUNNEL_ID" "$CONFIG"; then
  echo "WARNING: $CONFIG does not reference $TUNNEL_ID." >&2
  echo "         Update the 'tunnel:' line in that file AND the creds mount path" >&2
  echo "         in docker-compose.yml to this tunnel ID before starting." >&2
fi

# Create DNS records (CNAME -> tunnel) for each hostname.
for host in arcflow.click www.arcflow.click api.arcflow.click; do
  echo ">> Routing DNS: $host"
  cloudflared tunnel route dns "$TUNNEL_NAME" "$host" || echo "   (record may already exist — ok)"
done

# Retire any legacy host-side tunnel so it doesn't run alongside the container.
LEGACY_PLIST="$HOME/Library/LaunchAgents/com.arcflow.tunnel.plist"
if [ -f "$LEGACY_PLIST" ]; then
  echo ">> Disabling legacy launchd agent (now superseded by Docker)..."
  launchctl unload "$LEGACY_PLIST" 2>/dev/null || true
  mv "$LEGACY_PLIST" "$LEGACY_PLIST.disabled"
fi
if [ -f "$CF_DIR/config.yml" ]; then
  echo ">> Removing stale host config $CF_DIR/config.yml (Docker config is authoritative)..."
  rm -f "$CF_DIR/config.yml"
fi

echo ""
echo "Setup done. Start everything (app + tunnel) with:"
echo "   cd $REPO_DIR && docker compose up -d"
echo "Tail the tunnel log with:"
echo "   docker logs -f arcflow-tunnel"
