#!/bin/bash

# Build with Bun for both bundling and individual files
if [ -n "$MINIFIED" ]; then
    echo "Building minified..."
    bun run build:min
else
    echo "Building..."
    bun run build
fi
