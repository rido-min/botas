#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Building .NET..."
cd "$ROOT_DIR/dotnet"
dotnet restore Botas.slnx
dotnet build Botas.slnx --no-restore

echo "Building Node..."
cd "$ROOT_DIR/node"
npm ci
npm run build --workspaces --if-present

echo "Building Python..."
cd "$ROOT_DIR/python/packages/botas"
pip install -e ".[dev]"

echo "Building Python (FastAPI integration)..."
cd "$ROOT_DIR/python/packages/botas-fastapi"
pip install -e ".[dev]"

echo "All projects built successfully."
