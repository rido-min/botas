#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

ENV_FILE=${1:-$REPO_ROOT/.env}
LAUNCH_SETTINGS_FILE=${2:-$REPO_ROOT/dotnet/samples/EchoBot/Properties/launchSettings.json}

if [ ! -f "$ENV_FILE" ]; then
  printf 'Error: env file not found: %s\n' "$ENV_FILE" >&2
  exit 1
fi

if [ ! -f "$LAUNCH_SETTINGS_FILE" ]; then
  printf 'Error: launchSettings file not found: %s\n' "$LAUNCH_SETTINGS_FILE" >&2
  exit 1
fi

CLIENT_ID=""
CLIENT_SECRET=""
TENANT_ID=""
PORT=""

while IFS= read -r line || [ -n "$line" ]; do
  # Strip comments and leading/trailing whitespace.
  line=$(printf '%s' "$line" | sed 's/[[:space:]]*$//;s/^[[:space:]]*//')
  case "$line" in
    \#*|"")
      continue
      ;;
  esac
  case "$line" in
    CLIENT_ID=*)
      CLIENT_ID=${line#CLIENT_ID=}
      ;;
    CLIENT_SECRET=*)
      CLIENT_SECRET=${line#CLIENT_SECRET=}
      ;;
    TENANT_ID=*)
      TENANT_ID=${line#TENANT_ID=}
      ;;
    PORT=*)
      PORT=${line#PORT=}
      ;;
  esac
done < "$ENV_FILE"

python3 - "$LAUNCH_SETTINGS_FILE" "$CLIENT_ID" "$TENANT_ID" "$CLIENT_SECRET" "$PORT" <<'PY'
import json
import os
import re
import sys
from urllib.parse import urlparse, urlunparse

launch_settings_path = os.path.abspath(sys.argv[1])
client_id = sys.argv[2]
tenant_id = sys.argv[3]
client_secret = sys.argv[4]
port = sys.argv[5]

with open(launch_settings_path, 'r', encoding='utf-8') as handle:
    data = json.load(handle)

profiles = data.setdefault('profiles', {})
profile = profiles.setdefault('http', {})
application_url = profile.get('applicationUrl', '')

if port:
    if application_url:
        parsed = urlparse(application_url)
        if parsed.scheme and parsed.hostname:
            netloc = parsed.hostname
            if port:
                netloc = f'{parsed.hostname}:{port}'
            if parsed.username:
                netloc = f'{parsed.username}@{netloc}'
            if parsed.port and parsed.port != int(port):
                netloc = f'{parsed.hostname}:{port}'
            parsed = parsed._replace(netloc=netloc)
            application_url = urlunparse(parsed)
        else:
            application_url = re.sub(r':\d+$', ':' + port, application_url)
        profile['applicationUrl'] = application_url

env_vars = profile.setdefault('environmentVariables', {})
if client_id:
    env_vars['AzureAd__ClientId'] = client_id
if tenant_id:
    env_vars['AzureAd__TenantId'] = tenant_id
if client_secret:
    env_vars['AzureAd__ClientCredentials__0__ClientSecret'] = client_secret

with open(launch_settings_path, 'w', encoding='utf-8') as handle:
    json.dump(data, handle, indent=2)
    handle.write('\n')
PY

printf 'Updated %s from %s\n' "$LAUNCH_SETTINGS_FILE" "$ENV_FILE"
