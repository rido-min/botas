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
rm -rf docs-site/api/generated/dotnet

# Build to generate XML documentation
echo "   Building .NET project..."
dotnet build dotnet/Botas.slnx --configuration Release --verbosity quiet /p:NoWarn=NU1903

# Generate DocFX metadata then build HTML site
echo "   Running DocFX metadata..."
docfx metadata docfx.json
echo "   Building DocFX site..."
docfx build docfx.json
echo "   ✅ .NET API docs generated to docs-site/api/generated/dotnet/"

# Node.js API docs with TypeDoc (botas-core)
echo "📗 Generating Node.js API docs (botas-core)..."
cd node/packages/botas-core
echo "   Installing dependencies..."
npm install --silent
echo "   Running TypeDoc..."
npm run docs --silent

# Node.js API docs with TypeDoc (botas-express)
echo "📗 Generating Node.js API docs (botas-express)..."
cd ../botas-express
echo "   Installing dependencies..."
npm install --silent
echo "   Running TypeDoc..."
npm run docs --silent

# Python API docs with pdoc (botas core)
echo "📙 Generating Python API docs (botas)..."
cd ../../../python/packages/botas
echo "   Installing dependencies..."
pip install -q -e ".[dev]"
echo "   Running markdown doc generator..."
python ../../../docs-site/scripts/generate_python_md_docs.py botas ../../../docs-site/api/generated/python/botas

# Python API docs (botas-fastapi)
echo "📙 Generating Python API docs (botas-fastapi)..."
cd ../botas-fastapi
echo "   Installing dependencies..."
pip install -q -e ".[dev]"
echo "   Running markdown doc generator..."
python ../../docs-site/scripts/generate_python_md_docs.py botas_fastapi ../../docs-site/api/generated/python/botas-fastapi

echo "✅ API documentation generated successfully!"
echo ""
echo "Next steps:"
echo "  1. cd ../../../docs-site"
echo "  2. npm run docs:build"
echo "  3. npm run docs:preview"
