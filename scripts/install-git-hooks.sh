#!/bin/bash
# Install git hooks to enforce main branch link strategy
# Run this once to set up hooks in your local repository

set -e

if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository"
    echo "   Run this script from the repository root"
    exit 1
fi

echo "📦 Installing git hooks..."
echo ""

# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

# Install pre-commit hook
echo "Installing pre-commit hook..."
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook - check for linked packages on main branch

BRANCH=$(git branch --show-current 2>/dev/null || echo "")

if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
    if [ -L "node_modules/@jonverrier/assistant-common" ]; then
        echo ""
        echo "❌ PRE-COMMIT CHECK FAILED"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Cannot commit to '$BRANCH' branch with linked packages!"
        echo ""
        echo "Main branch must use GitHub Packages only (not local links)."
        echo ""
        echo "To fix:"
        echo "  1. Run: npm run unlink-local"
        echo "  2. Verify: npm run link-status"
        echo "  3. Then commit again"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        exit 1
    fi
fi

exit 0
EOF

chmod +x .git/hooks/pre-commit

# Install pre-push hook
echo "Installing pre-push hook..."
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash
# Pre-push hook - check for linked packages on main branch

BRANCH=$(git branch --show-current 2>/dev/null || echo "")

if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
    if [ -L "node_modules/@jonverrier/assistant-common" ]; then
        echo ""
        echo "❌ PRE-PUSH CHECK FAILED"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Cannot push to '$BRANCH' branch with linked packages!"
        echo ""
        echo "Main branch must use GitHub Packages only (not local links)."
        echo ""
        echo "To fix:"
        echo "  1. Run: npm run unlink-local"
        echo "  2. Verify: npm run link-status"
        echo "  3. Then push again"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        exit 1
    fi
fi

exit 0
EOF

chmod +x .git/hooks/pre-push

echo "✅ Git hooks installed successfully!"
echo ""
echo "The following hooks are now active:"
echo "  - pre-commit: Prevents committing to main with linked packages"
echo "  - pre-push: Prevents pushing to main with linked packages"
echo ""
echo "These hooks only run on 'main' or 'master' branches."
echo "Development branches can still use links freely."
echo ""
echo "To manually run checks:"
echo "  npm run verify-main       # Check main branch configuration"
echo "  npm run pre-commit-check  # Run pre-commit check manually"
echo "  npm run pre-push-check    # Run pre-push check manually"

