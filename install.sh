#!/bin/bash

set -e

# Detect if we're in a firejail container
if [ "$container" = "firejail" ]; then
    INSTALL_DIR="/tmp/aicoder-mini-install"
    BIN_DIR="/tmp/aicoder-mini-bin"
    export BUN_TMPDIR="/tmp/bun-tmp"
    export BUN_INSTALL="/tmp/bun-install"
    SANDBOX_MODE=1
elif [ -w "$HOME" ]; then
    INSTALL_DIR="$HOME/.local/share/aicoder-mini"
    BIN_DIR="$HOME/.local/bin"
    SANDBOX_MODE=0
else
    INSTALL_DIR="/tmp/aicoder-mini-install"
    BIN_DIR="/tmp/aicoder-mini-bin"
    export BUN_TMPDIR="/tmp/bun-tmp"
    export BUN_INSTALL="/tmp/bun-install"
    SANDBOX_MODE=1
fi

BIN_PATH="$BIN_DIR/aicoder-mini"

echo "Installing aicoder-mini to $INSTALL_DIR..."

# Create temp directories for bun in sandbox only if needed
if [ "$SANDBOX_MODE" = "1" ]; then
    mkdir -p "$BUN_TMPDIR" "$BUN_INSTALL"
fi

# Install directory
mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"

# Copy package files (excluding node_modules)
rsync -av --exclude=node_modules --exclude=dist --exclude=.git . "$INSTALL_DIR/" 2>/dev/null || cp -r . "$INSTALL_DIR/"

# Build the TypeScript project
cd "$INSTALL_DIR"

# Install dependencies including @types/bun
bun install --no-save
bun add -D @types/bun

# Build the project
bun run build

# Create the wrapper script that runs the compiled version
cat > "$BIN_PATH" << EOF
#!/bin/bash
cd "$INSTALL_DIR"
exec bun dist/index.js "\$@"
EOF

# Make executable
chmod +x "$BIN_PATH"

# Path information
if [ "$SANDBOX_MODE" = "1" ]; then
    echo ""
    echo "Running in sandbox mode (detected: $container). To use aicoder-mini:"
    echo "  export PATH=\"$BIN_DIR:\$PATH\""
    echo "  aicoder-mini"
elif ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
    echo ""
    echo "Add ~/.local/bin to your PATH:"
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
fi

echo ""
echo "Installation complete! Run 'aicoder-mini' to start."
