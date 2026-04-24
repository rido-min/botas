"""Generate markdown API documentation from Python modules using pdoc.

This script extracts documentation from Python modules and generates
VitePress-compatible markdown files with cross-linked types.
"""

import re
from pathlib import Path

import pdoc
import pdoc.doc


def sanitize_name(name: str) -> str:
    """Convert module/class name to a safe filename."""
    return name.replace(".", "_")


def get_summary(docstring: str) -> str:
    """Get the first line of a docstring."""
    if not docstring:
        return ""
    return docstring.split("\n\n")[0].replace("\n", " ")


def add_cross_links(content: str, all_types: set[str]) -> str:
    """Add markdown links to botas type references."""
    # Pattern to match botas types in code blocks and signatures
    for full_type in all_types:
        # Create link target (e.g., botas.core_activity.CoreActivity -> botas_core_activity)
        module_part = ".".join(full_type.split(".")[:-1])  # e.g., botas.core_activity
        link_target = sanitize_name(module_part)
        
        # Replace full qualified names with links (outside code blocks)
        # This is a simple approach - just replace in type annotations
        pattern = f"({full_type})"
        replacement = f"[{full_type}](./{link_target}.md#{full_type.split('.')[-1]})"
        
        # Only replace in certain contexts (after "Type:", in parameter lists)
        content = re.sub(
            f"(\\*\\*Type:\\*\\* `){full_type}(`)",
            f"\\1[{full_type}](./{link_target}.md)\\2",
            content
        )
    
    return content


def generate_module_doc(mod: pdoc.doc.Module, output_dir: Path, all_types: set[str]) -> None:
    """Generate markdown documentation for a module."""
    mod_file = output_dir / f"{sanitize_name(mod.fullname)}.md"

    lines = [
        f"# {mod.fullname}\n\n",
    ]

    if mod.docstring:
        lines.append(f"{mod.docstring}\n\n")

    # Classes
    for cls in mod.classes:
        lines.append(f"## class `{cls.name}`\n\n")
        if cls.docstring:
            lines.append(f"{cls.docstring}\n\n")

        # Constructor
        init_method = cls.members.get("__init__")
        if init_method and hasattr(init_method, "signature"):
            lines.append(f"### `__init__`\n\n")
            sig_str = str(init_method.signature).replace(cls.fullname + ".", "")
            lines.append(f"```python\n{sig_str}\n```\n\n")
            if init_method.docstring:
                lines.append(f"{init_method.docstring}\n\n")

        # Methods
        for method in cls.methods:
            if method.name.startswith("_"):
                continue  # Skip private methods
            lines.append(f"### `{method.name}`\n\n")
            if hasattr(method, "signature") and method.signature:
                sig_str = str(method.signature).replace(cls.fullname + ".", "")
                lines.append(f"```python\n{sig_str}\n```\n\n")
            if method.docstring:
                lines.append(f"{method.docstring}\n\n")

        # Properties/Variables
        for var in cls.instance_variables + cls.class_variables:
            if not var.name.startswith("_"):
                lines.append(f"### `{var.name}`\n\n")
                # Try to get type annotation
                if hasattr(var, "annotation") and var.annotation:
                    lines.append(f"**Type:** `{var.annotation}`\n\n")
                if var.docstring:
                    lines.append(f"{var.docstring}\n\n")

    # Module-level Functions
    if mod.functions:
        for func in mod.functions:
            if not func.name.startswith("_"):
                lines.append(f"## `{func.name}`\n\n")
                if hasattr(func, "signature") and func.signature:
                    lines.append(f"```python\n{func.signature}\n```\n\n")
                if func.docstring:
                    lines.append(f"{func.docstring}\n\n")

    # Module-level Variables
    if mod.variables:
        for var in mod.variables:
            if not var.name.startswith("_") and not var.name.isupper():  # Skip constants
                lines.append(f"## `{var.name}`\n\n")
                if hasattr(var, "annotation") and var.annotation:
                    lines.append(f"**Type:** `{var.annotation}`\n\n")
                if var.docstring:
                    lines.append(f"{var.docstring}\n\n")

    content = "".join(lines)
    
    # Add cross-links to botas types
    content = add_cross_links(content, all_types)
    
    mod_file.write_text(content, encoding="utf-8")
    print(f"  Generated {mod_file.name}")


def generate_index(modules: list[pdoc.doc.Module], output_dir: Path, package_name: str) -> None:
    """Generate an index page for all modules."""
    index_file = output_dir / "index.md"

    lines = [
        f"# {package_name} API Reference\n\n",
        "Auto-generated API documentation.\n\n",
        "## Modules\n\n",
    ]

    for mod in sorted(modules, key=lambda m: m.fullname):
        mod_link = sanitize_name(mod.fullname)
        summary = get_summary(mod.docstring)
        lines.append(f"- [`{mod.fullname}`](./{mod_link}.md)")
        if summary:
            lines.append(f" — {summary}")
        lines.append("\n")

    index_file.write_text("".join(lines), encoding="utf-8")
    print(f"  Generated {index_file.name}")


def main() -> None:
    """Generate markdown docs for botas packages."""
    import sys

    if len(sys.argv) < 3:
        print("Usage: python generate_md_docs.py <package_name> <output_dir>")
        sys.exit(1)

    package_name = sys.argv[1]
    output_dir = Path(sys.argv[2])

    print(f"Generating markdown docs for {package_name}...")

    # Configure pdoc
    pdoc.render.configure(
        docformat="google",
        include_undocumented=False,
    )

    # Extract the main module
    main_mod = pdoc.doc.Module.from_name(package_name)

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # Generate docs for the main module
    doc_modules = [main_mod]

    # Get all submodules
    import pkgutil
    import importlib

    try:
        package = importlib.import_module(package_name)
        if hasattr(package, "__path__"):
            for importer, modname, ispkg in pkgutil.walk_packages(
                path=package.__path__, prefix=package.__name__ + "."
            ):
                try:
                    mod = pdoc.doc.Module.from_name(modname)
                    doc_modules.append(mod)
                except Exception as e:
                    print(f"  ⚠ Skipping {modname}: {e}")
    except Exception as e:
        print(f"  ⚠ Could not walk package: {e}")

    # Generate docs for each module
    # First pass: collect all types
    all_types = set()
    for mod in doc_modules:
        for cls in mod.classes:
            all_types.add(cls.fullname)
    
    # Second pass: generate docs with cross-linking
    for mod in doc_modules:
        generate_module_doc(mod, output_dir, all_types)

    # Generate index
    generate_index(doc_modules, output_dir, package_name)

    print(f"Generated {len(doc_modules)} module docs in {output_dir}")


if __name__ == "__main__":
    main()
