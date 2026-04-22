#!/bin/bash
# generate-api-docs.sh
# Generate API reference documentation for all three languages

set -e

echo "🔧 Generating API documentation for Botas..."

# .NET API docs with DefaultDocumentation
echo "📘 Generating .NET API docs..."
cd ../dotnet
if ! command -v defaultdocumentation &> /dev/null; then
    echo "   Installing DefaultDocumentation..."
    dotnet tool install --global DefaultDocumentation.Console
fi
# Build the project first to generate XML documentation
echo "   Building .NET project..."
dotnet build Botas.slnx --configuration Release --verbosity quiet
echo "   Running DefaultDocumentation..."
# Generate markdown docs from the built assembly
ASSEMBLY_PATH="src/Botas/bin/Release/net10.0/Botas.dll"
if [ -f "$ASSEMBLY_PATH" ]; then
    mkdir -p ../docs-site/api/generated/dotnet
    defaultdocumentation --AssemblyFilePath "$ASSEMBLY_PATH" --OutputDirectoryPath ../docs-site/api/generated/dotnet --GeneratedPages "Namespaces, Types, Members"
    echo "   ✅ .NET API docs generated to docs-site/api/generated/dotnet/"
else
    echo "   ⚠️  Assembly not found at $ASSEMBLY_PATH"
fi

# Node.js API docs with TypeDoc (botas-core)
echo "📗 Generating Node.js API docs (botas-core)..."
cd ../node/packages/botas-core
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
