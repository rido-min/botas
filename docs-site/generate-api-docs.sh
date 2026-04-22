#!/bin/bash
# generate-api-docs.sh
# Generate API reference documentation for all three languages

set -e

echo "🔧 Generating API documentation for Botas..."

# .NET API docs with DocFX
echo "📘 Generating .NET API docs..."
cd ../dotnet
if ! command -v docfx &> /dev/null; then
    echo "   Installing DocFX..."
    dotnet tool install --global docfx
fi
# Build the project first to generate XML documentation
echo "   Building .NET project..."
dotnet build Botas.slnx --configuration Release --verbosity quiet
echo "   Running DocFX..."
docfx docfx.json
# Copy output to docs-site
mkdir -p ../docs-site/api/dotnet
cp -r _site/* ../docs-site/api/dotnet/ 2>/dev/null || echo "   ⚠️  DocFX output not found (expected at _site/)"

# Node.js API docs with TypeDoc
echo "📗 Generating Node.js API docs..."
cd ../node/packages/botas
echo "   Installing dependencies..."
npm install --silent
echo "   Running TypeDoc..."
npm run docs --silent
# Copy output to docs-site
mkdir -p ../../../docs-site/api/nodejs
cp -r docs/api/* ../../../docs-site/api/nodejs/ 2>/dev/null || echo "   ⚠️  TypeDoc output not found (expected at docs/api/)"

# Python API docs with pdoc
echo "📙 Generating Python API docs..."
cd ../../../python/packages/botas
echo "   Installing dependencies..."
pip install -q -e ".[dev]"
echo "   Running pdoc..."
pdoc --html --output-dir ../../../docs-site/api/python botas
# pdoc creates a subdirectory with the module name, move contents up
if [ -d "../../../docs-site/api/python/botas" ]; then
    mv ../../../docs-site/api/python/botas/* ../../../docs-site/api/python/ 2>/dev/null || true
    rmdir ../../../docs-site/api/python/botas 2>/dev/null || true
fi

echo "✅ API documentation generated successfully!"
echo ""
echo "Next steps:"
echo "  1. cd ../../../docs-site"
echo "  2. npm run docs:build"
echo "  3. npm run docs:preview"
