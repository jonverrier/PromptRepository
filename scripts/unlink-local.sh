#!/bin/bash
# Unlink local AssistantCommon and restore GitHub package

echo "🔓 Unlinking local AssistantCommon..."

# Unlink in PromptRepository
npm unlink @jonverrier/assistant-common

echo "📦 Reinstalling from GitHub Packages..."
npm install

echo "✅ Done! Now using @jonverrier/assistant-common from GitHub Packages"

