#!/bin/bash
# Link local AssistantCommon for development

echo "🔗 Linking local AssistantCommon..."

# Check if AssistantCommon exists
if [ ! -d "../AssistantCommon" ]; then
    echo "❌ Error: ../AssistantCommon directory not found"
    echo "   Make sure AssistantCommon is in the same parent directory"
    exit 1
fi

# Check if AssistantCommon package is built
if [ ! -d "../AssistantCommon/dist" ]; then
    echo "⚠️  Warning: AssistantCommon package not built. Building now..."
    (cd ../AssistantCommon && npm run build)
fi

# Create link in AssistantCommon
cd ../AssistantCommon
echo "📦 Creating npm link in AssistantCommon..."
npm link

# Return to PromptRepository and link
cd ../PromptRepository
echo "🔗 Linking @jonverrier/assistant-common in PromptRepository..."
npm link @jonverrier/assistant-common

echo "✅ Done! Local AssistantCommon is now linked"
echo "   Changes in ../AssistantCommon will be immediately available"
echo ""
echo "To unlink, run: npm run unlink-local"

