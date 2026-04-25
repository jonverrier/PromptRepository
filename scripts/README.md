# Exceptional Local Development Scripts

These scripts exist for temporary local-link sessions while keeping GitHub Packages references in `package.json`. They are not the default local development workflow.

By default, build, test, publish `AssistantCommon` through GitHub Packages, then update `PromptRepository` to consume the published version. Use local links only when explicitly directed by the lead architect, or by the user when an AI tool is doing the work.

## npm link for AssistantCommon

### Link Local Version (exception only)

When explicitly directed to develop both `PromptRepository` and `AssistantCommon` with local links:

```bash
npm run link-local
```

**What this does:**
1. Creates a global npm link for `@jonverrier/assistant-common` from `../AssistantCommon`
2. Links that package into this project's `node_modules`
3. Changes in `../AssistantCommon` are immediately available without rebuilding

**Use when:**
- The lead architect explicitly requested linked local development
- The user explicitly requested linked local development for AI-tooling work
- You will unlink before merge, publish, release validation, or CI handoff

### Check Link Status

See if you're using local or GitHub package:

```bash
npm run link-status
```

**Output:**
- `✅ LINKED to local` - Using local AssistantCommon
- `📦 Using GitHub Package` - Using published version

### Unlink (restore GitHub package)

When the exceptional local-link session is done:

```bash
npm run unlink-local
```

**What this does:**
1. Removes the local link
2. Reinstalls `@jonverrier/assistant-common` from GitHub Packages
3. Restores to the version specified in `package.json`

**Use when:**
- Finished the approved local-link session
- Ready to test with published versions
- **Before merging to main branch**
- **Before publishing or release validation**
- **Before pushing to CI/CD**

## Branch Strategy

### Main Branch (Production)
- ✅ **Always unlinked** - Uses GitHub Packages only
- ✅ **Always buildable** - Works in CI/CD
- ✅ **Reproducible** - Same dependencies everywhere

### Development Branches
- **Default to GitHub Packages** - Publish dependencies after the normal checks and consume the published version
- **Links by exception only** - Use links only under explicit direction
- **Unlink before merging** - Ensure main stays clean

## Development Workflow

### Default workflow when changing both packages:

```bash
# 1. Create/checkout development branch
git checkout -b feature/my-feature
# or
git checkout develop

# 2. Make changes in ../AssistantCommon
cd ../AssistantCommon
# edit files...
npm run build
npm run test:ci
# publish the approved version through GitHub Packages
cd ../PromptRepository

# 3. Update PromptRepository to the published AssistantCommon version
npm install
npm run build
npm test

# 4. Commit and push
git commit -am "My changes"
git push
```

For an explicitly approved local-link session, run `npm run link-local`, do the short feedback loop, then run `npm run unlink-local` and verify `npm run link-status` before merge, publish, or release validation.

### Pre-commit Checklist

**Before committing to main branch:**

```bash
# 1. Check link status
npm run link-status

# 2. If linked, unlink first
npm run unlink-local

# 3. Verify build works
npm run build
npm test

# 4. Commit
git commit -am "My changes"
```

## Enforcement Mechanisms

### Automatic Git Hooks (Recommended)

Install git hooks to automatically prevent committing/pushing to main with linked packages:

```bash
# One-time setup (run from repository root)
bash scripts/install-git-hooks.sh
```

This installs:
- **pre-commit hook**: Blocks commits to main if packages are linked
- **pre-push hook**: Blocks pushes to main if packages are linked

These hooks only run on `main`/`master` branches - development branches still require policy discipline.

### Manual Verification

Before merging to main, always verify:

```bash
npm run verify-main
```

This checks that:
- You're on main branch (if applicable)
- No packages are linked
- Packages are installed from GitHub Packages

### Manual Pre-commit/Pre-push Checks

You can also run the checks manually:

```bash
npm run pre-commit-check  # Check before committing
npm run pre-push-check   # Check before pushing
```

## Important Notes

**The link is local only** - CI/CD always uses the GitHub package from `package.json`

**Remember to unlink** - If you forget, your local builds can pass while CI/CD fails because dependency changes were not published

**package.json never changes** - The GitHub package reference stays clean, no merge conflicts

**node_modules is gitignored** - Symlinks never get committed, so each branch can have different link states

**Main branch discipline** - Always keep main unlinked to ensure it's always buildable

**Enforcement** - Git hooks prevent accidentally committing/pushing to main with links

## Troubleshooting

**"Module not found" after linking:**
```bash
cd ../AssistantCommon
npm run build  # Build the package first
cd ../PromptRepository
npm run link-local
```

**Want to verify it's working:**
```bash
npm run link-status
ls -la node_modules/@jonverrier/assistant-common  # Should show symlink
```

**To reset everything:**
```bash
npm run unlink-local
rm -rf node_modules package-lock.json
npm install
```

**Check before merging to main:**
```bash
# Always verify main branch strategy
git checkout main
npm run link-status  # Should show "Using GitHub Package"
npm run build        # Should work
npm test            # Should pass
```

