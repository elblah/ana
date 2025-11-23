#!/bin/bash

snippets=$(find docs/examples/snippets -type f)

sels=$(echo "$snippets" | fzf -m -e)

mkdir -p ~/.config/aicoder-mini/snippets

# Get the aicoder source directory
AICODER_DIR=$(cd "$(dirname "$0")" && pwd)

while read -r LINE; do
    echo "Installing: $LINE"
    cp "$LINE" ~/.config/aicoder-mini/snippets/"$filename"
done <<< "$sels"
