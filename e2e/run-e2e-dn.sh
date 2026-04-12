#!/usr/bin/env bash
# Run .NET e2e tests. The EchoBot sample is hosted in-process via WebApplicationFactory
# so no separate bot start/stop is needed.
set -e
dotnet test e2e/dotnet
