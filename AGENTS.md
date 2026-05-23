# PromptRepository Agent Instructions

Instructions for AI assistants working on the `@jonverrier/prompt-repository` package. This is a **standalone** repository — not part of a monorepo workspace.

## Project Overview

PromptRepository is a publishable TypeScript library that provides:

- Prompt storage and template expansion (`PromptInMemoryRepository`, `PromptFileRepository`)
- Provider-agnostic chat and embedding drivers (OpenAI, Azure OpenAI, Google Gemini, Anthropic)
- Tool/function calling, file attachments, and table JSON support
- Bundled meta-prompts for generating unit tests and evals for your own prompts

The library was built for the Strong AI platform and is consumed by C4-Auto, Ripstop, Assistant, and other packages — but its public API is general-purpose.

## Package Structure

```text
src/
  entry.ts              Public export surface (keep stable)
  PromptRepository.ts   IPromptRepository implementations
  ChatDriver*.ts          Chat drivers and factories
  EmbeddingDriver*.ts     Embedding drivers
  Prompts.json            Bundled meta-prompts (eval/test generators)
  prompts/              Additional prompt metadata as needed
test/                     Jest unit, integration, and mini projects
dist/                     Published compiled output
```

## Library Charter

- Provide reusable prompt templates, driver factories, and embedding utilities for both Node.js and browser runtimes.
- Keep the public API stable — `src/entry.ts` exports the full surface; any new module must be re-exported there.
- Ensure implementations remain environment-agnostic by guarding Node-only modules (`fs`, `path`) with dynamic imports or adapters.

## Prompts And Drivers

- Store canonical prompt metadata in JSON/TS files under `src/`; include descriptions, parameter schemas, and version fields.
- Validate parameters before expansion with shared helpers; throw `InvalidParameterError` from `@jonverrier/assistant-common` (re-exported) when inputs fail validation.
- Driver factories (chat + embedding) must accept provider configs via typed enums and expose streaming + non-streaming methods.
- When adding a new provider or model, update the enums, factory switch statements, and `README.md`.

## Build, Test, And Publish

```bash
npm install
npm run build
npm run test:ci        # unit subset — no API keys
npm run test:integration   # live LLM (needs provider API keys)
npm run test:mini      # smaller live-LLM subset
```

**Publish** (GitHub Packages): bump version, merge to `main`, `npm publish` with `NODE_AUTH_TOKEN`. GitHub Actions also publishes on release.

## Coding Standards

- TypeScript strict mode, ES2022, CommonJS.
- Use `@jonverrier/assistant-common` error classes — never raw `Error`.
- Interface prefix `I`, enum prefix `E`, enum members prefix `k`.
- JSDoc on public modules/functions; copyright header on source files.
- Tests: Jest + `expect`; `describe`/`it` are globals.

## Testing Notes

- Scripts: `npm test` (unit — all), `npm run test:ci` (CI subset, no API keys), `npm run test:integration` (serial live LLM), `npm run test:mini`.
- Cover prompt expansion, parameter validation, error handling, and driver wiring for every supported provider.
- Keep golden prompt fixtures in `test/fixtures`; regenerate intentionally when prompts change.
- Do not pipe live Jest output through `tail`/`grep` — run `npm run test:ci` directly.

## Git Safety

- Never run destructive git commands unless explicitly requested.
- Do not delete untracked files without approval.
- Inspect `git status --short --branch` before committing.
- No AI attribution in commit messages.

## Related Packages

- **AssistantCommon** (`@jonverrier/assistant-common`) — shared error types and utilities (dependency).
- **C4-Auto** (`@jonverrier/c4-auto`) — automated C4 documentation CLI using this library for LLM calls.
- **Ripstop** (`@jonverrier/ripstop`) — Git guardrails CLI; uses assistant-common error types transitively.
