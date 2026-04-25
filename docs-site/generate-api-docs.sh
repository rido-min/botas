#!/bin/bash
# generate-api-docs.sh
# Generate API reference documentation for all three languages

set -e

echo "🔧 Generating API documentation for Botas..."

# .NET API docs with DocFX
echo "📘 Generating .NET API docs (DocFX)..."
cd ..

# Install DocFX if not available
if ! command -v docfx &> /dev/null; then
    echo "   Installing DocFX..."
    dotnet tool install --global docfx
fi

# Clean previous output
rm -rf docs-site/public/api/generated/dotnet

# Build to generate XML documentation
echo "   Building .NET project..."
dotnet build dotnet/Botas.slnx --configuration Release --verbosity quiet /p:TreatWarningsAsErrors=false

# Generate DocFX metadata then build HTML site
echo "   Running DocFX metadata..."
docfx metadata docfx.json
echo "   Building DocFX site..."
docfx build docfx.json
echo "   ✅ .NET API docs generated to docs-site/public/api/generated/dotnet/"

# Node.js API docs with TypeDoc
echo "📗 Generating Node.js API docs..."
cd node
echo "   Installing workspace dependencies..."
npm install --silent
echo "   Building workspace..."
npm run build --silent

echo "   Running TypeDoc (botas-core)..."
cd packages/botas-core
npm run docs --silent

# Node.js API docs with TypeDoc (botas-express)
echo "   Running TypeDoc (botas-express)..."
cd ../botas-express
npm run docs --silent

# Python API docs with pdoc (botas core)
echo "📙 Generating Python API docs (botas)..."
cd ../../../python/packages/botas
echo "   Installing dependencies..."
pip install -q -e ".[dev]"
echo "   Running pdoc..."
pdoc --template-directory ../../../docs-site/api-theme/pdoc -o ../../../docs-site/public/api/generated/python/botas botas

# Python API docs (botas-fastapi)
echo "📙 Generating Python API docs (botas-fastapi)..."
cd ../botas-fastapi
echo "   Installing dependencies..."
pip install -q -e ".[dev]"
echo "   Running pdoc..."
pdoc --template-directory ../../../docs-site/api-theme/pdoc -o ../../../docs-site/public/api/generated/python/botas-fastapi botas_fastapi

echo "✅ API documentation generated successfully!"
echo ""
echo "Next steps:"
echo "  1. cd ../../../docs-site"
echo "  2. npm run docs:build"
echo "  3. npm run docs:preview"
