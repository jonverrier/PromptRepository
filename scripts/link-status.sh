#!/bin/bash
# Check if local AssistantCommon is linked

echo "🔍 Checking link status..."
echo ""

if [ -L "node_modules/@jonverrier/assistant-common" ]; then
    TARGET=$(readlink "node_modules/@jonverrier/assistant-common")
    echo "✅ LINKED to local: $TARGET"
    echo ""
    echo "Using local development version"
else
    PKG_VERSION=$(node -p "require('./node_modules/@jonverrier/assistant-common/package.json').version" 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "📦 Using GitHub Package version: $PKG_VERSION"
    else
        echo "❌ assistant-common not found"
        echo "   Run: npm install"
    fi
fi

