#!/bin/bash

# Council Installation Script
# Sets up a basic council configuration for AI Coder

set -e

COUNCIL_DIR="$HOME/.config/aicoder-mini/council"
EXAMPLE_DIR="$(dirname "$0")"

echo "Setting up AI Coder Council..."

# Create council directory
if [ ! -d "$COUNCIL_DIR" ]; then
    mkdir -p "$COUNCIL_DIR"
    echo "✓ Created council directory: $COUNCIL_DIR"
else
    echo "Council directory already exists: $COUNCIL_DIR"
fi

# Copy essential members
echo "Copying council members..."

# Required: Moderator
if [ -f "$EXAMPLE_DIR/moderator.txt" ]; then
    cp "$EXAMPLE_DIR/moderator.txt" "$COUNCIL_DIR/"
    echo "✓ Copied moderator"
fi

# Pre-idea members (for planning phase)
for file in preidea_simplicity_advocate.txt preidea_security_expert.txt; do
    if [ -f "$EXAMPLE_DIR/$file" ]; then
        cp "$EXAMPLE_DIR/$file" "$COUNCIL_DIR/"
        echo "✓ Copied $file"
    fi
done

# Optional: More specialized members
read -p "Include UX Designer? (y/N): " include_ux
if [[ $include_ux =~ ^[Yy]$ ]]; then
    if [ -f "$EXAMPLE_DIR/preidea_ux_designer.txt" ]; then
        cp "$EXAMPLE_DIR/preidea_ux_designer.txt" "$COUNCIL_DIR/"
        echo "✓ Copied preidea_ux_designer.txt"
    fi
fi

read -p "Include Performance Guru? (y/N): " include_perf
if [[ $include_perf =~ ^[Yy]$ ]]; then
    if [ -f "$EXAMPLE_DIR/preidea_performance_guru.txt" ]; then
        cp "$EXAMPLE_DIR/preidea_performance_guru.txt" "$COUNCIL_DIR/"
        echo "✓ Copied preidea_performance_guru.txt"
    fi
fi

read -p "Include Feasibility Checker? (y/N): " include_feasibility
if [[ $include_feasibility =~ ^[Yy]$ ]]; then
    if [ -f "$EXAMPLE_DIR/preidea_feasibility_checker.txt" ]; then
        cp "$EXAMPLE_DIR/preidea_feasibility_checker.txt" "$COUNCIL_DIR/"
        echo "✓ Copied preidea_feasibility_checker.txt"
    fi
fi

read -p "Include Code Reviewer (post-implementation)? (y/N): " include_code
if [[ $include_code =~ ^[Yy]$ ]]; then
    if [ -f "$EXAMPLE_DIR/posimplementation_code_reviewer.txt" ]; then
        cp "$EXAMPLE_DIR/posimplementation_code_reviewer.txt" "$COUNCIL_DIR/"
        echo "✓ Copied posimplementation_code_reviewer.txt"
    fi
fi

# Count installed members
member_count=$(ls -1 "$COUNCIL_DIR"/*.txt 2>/dev/null | wc -l)

echo ""
echo "Council setup complete!"
echo "Location: $COUNCIL_DIR"
echo "Members installed: $member_count"
echo ""
echo "Usage examples:"
echo "  /council                    # All members"
echo "  /council preidea            # Pre-idea members only"
echo "  /council preidea,security   # Security + pre-idea"
echo "  /council current            # Show current plan"
echo "  /council accept             # Accept and inject plan"
echo ""
echo "See README.md for detailed usage instructions"