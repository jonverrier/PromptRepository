#!/bin/bash
# Verify that main branch is properly configured (unlinked, uses GitHub Packages)

set -e

BRANCH=$(git branch --show-current 2>/dev/null || echo "")

if [ -z "$BRANCH" ]; then
    echo "⚠️  Warning: Not in a git repository or no branch detected"
    exit 0  # Don't fail if not in git repo
fi

echo "🔍 Verifying main branch strategy..."
echo "   Current branch: $BRANCH"
echo ""

if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
    # Check if any packages are linked
    if [ -L "node_modules/@jonverrier/assistant-common" ]; then
        TARGET=$(readlink "node_modules/@jonverrier/assistant-common")
        echo "❌ ERROR: Cannot proceed on main branch with linked packages!"
        echo ""
        echo "   Linked package: node_modules/@jonverrier/assistant-common"
        echo "   → $TARGET"
        echo ""
        echo "   Main branch must use GitHub Packages only."
        echo "   Run: npm run unlink-local"
        echo ""
        exit 1
    fi
    
    # Verify package is installed (from GitHub Packages)
    if [ ! -d "node_modules/@jonverrier/assistant-common" ]; then
        echo "⚠️  Warning: assistant-common not installed"
        echo "   Run: npm install"
        exit 1
    fi
    
    # Verify it's not a symlink (should be a real directory from npm install)
    if [ -L "node_modules/@jonverrier/assistant-common" ]; then
        echo "❌ ERROR: assistant-common is linked on main branch!"
        echo "   Run: npm run unlink-local"
        exit 1
    fi
    
    echo "✅ Main branch verified: Using GitHub Packages (unlinked)"
    PKG_VERSION=$(node -p "require('./node_modules/@jonverrier/assistant-common/package.json').version" 2>/dev/null || echo "unknown")
    echo "   assistant-common version: $PKG_VERSION"
else
    echo "ℹ️  Not on main branch - link status check skipped"
    echo "   (Links are allowed on development branches)"
fi

exit 0

