#!/bin/bash

# Plugin installer for AI Coder TypeScript version

echo "Select plugins to install (use TAB to multi-select, ENTER to confirm):"

plugins=$(find plugins -name "*.ts" | grep -v test_)

sels=$(echo "$plugins" | fzf -m -e)

mkdir -p ~/.config/aicoder-mini/plugins

# Get the aicoder source directory
AICODER_DIR=$(cd "$(dirname "$0")" && pwd)

while read -r LINE; do
    echo "Installing: $LINE"
    filename=$(basename "$LINE" .ts)
    
    # Compile TypeScript to JavaScript during installation
    bun build "$LINE" --target bun --outfile ~/.config/aicoder-mini/plugins/"$filename".js
done <<< "$sels"

if [ -n "$sels" ]; then
    echo ""
    echo "[✓] Installation complete!"
    echo "Installed plugins: $(echo "$sels" | wc -l)"
    echo ""
    echo "Run AI Coder to load the plugins:"
    echo "  bun src/index.ts"
fi