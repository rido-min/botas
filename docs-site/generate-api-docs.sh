#!/bin/bash
# generate-api-docs.sh
# Generate API reference documentation for all three languages

set -e

echo "🔧 Generating API documentation for Botas..."

# Function to sanitize .NET docs by converting XML tags to markdown
sanitize_dotnet_docs() {
    echo "   Sanitizing .NET API docs (removing XML tags)..."
    local docs_dir="../docs-site/api/generated/dotnet"
    
    if [ ! -d "$docs_dir" ]; then
        echo "   ⚠️  No .NET docs directory found at $docs_dir"
        return
    fi
    
    # Process each markdown file
    find "$docs_dir" -name "*.md" -type f | while read -r file; do
        # Create a temporary file
        local temp_file="${file}.tmp"
        
        # Use awk to handle multi-line <example><code>...</code></example> blocks
        awk '
        /<example>/ {
            in_example = 1
            example_block = ""
            next
        }
        in_example {
            if (/<\/example>/) {
                # Extract code content between <code> and </code>
                gsub(/<\/?code>/, "", example_block)
                # Remove leading/trailing whitespace
                gsub(/^[[:space:]]+|[[:space:]]+$/, "", example_block)
                # Print as code fence
                print "```csharp"
                print example_block
                print "```"
                in_example = 0
                example_block = ""
                next
            }
            # Accumulate lines in example block, skip <code> tags
            if (/<\/?code>/) {
                next
            }
            if (example_block != "") {
                example_block = example_block "\n" $0
            } else {
                example_block = $0
            }
            next
        }
        # Strip other XML doc tags outside of code blocks
        {
            # Remove <see cref="..."/> and <see cref="...">...</see>
            gsub(/<see cref="[^"]*"[^>]*>([^<]*)<\/see>/, "\\1")
            gsub(/<see cref="[^"]*"[^>]*\/>/, "")
            # Remove <param>, <returns>, <summary>, <remarks> tags
            gsub(/<\/?param[^>]*>/, "")
            gsub(/<\/?returns[^>]*>/, "")
            gsub(/<\/?summary[^>]*>/, "")
            gsub(/<\/?remarks[^>]*>/, "")
            print
        }
        ' "$file" > "$temp_file"
        
        # Replace original with sanitized version
        mv "$temp_file" "$file"
    done
    
    echo "   ✅ .NET API docs sanitized"
}

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
    # Sanitize the generated docs to remove XML tags
    sanitize_dotnet_docs
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
