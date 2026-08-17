# Aion Workspace — Agent Guide

<!-- Maintenance: Keep this file short and actionable. Project-specific conventions
     live in each package's AGENTS.md. Do not duplicate architecture details here. -->

This workspace hosts four related projects that together form the AionUi product stack.
Work in the package that owns the change; always read that package's `AGENTS.md` first.

## Packages

| Directory | Role | Stack | Package agent guide |
| --------- | ---- | ----- | ------------------- |
| [`aion-app`](aion-app/) | AionUi desktop / WebUI client | Electron, TypeScript, Bun, Arco Design, UnoCSS | [`aion-app/AGENTS.md`](aion-app/AGENTS.md) |
| [`aion-core`](aion-core/) | AionUi backend server | Rust (Axum + Tokio + SQLite), Cargo workspace | [`aion-core/AGENTS.md`](aion-core/AGENTS.md) |
| [`aionrs`](aionrs/) | aionrs — multi-provider AI agent CLI / SDK, AionUi's embedded agent engine | Rust, Cargo workspace | [`aionrs/AGENTS.md`](aionrs/AGENTS.md) |
| [`office-cli`](office-cli/) | OfficeCLI — AI-oriented `.docx` / `.xlsx` / `.pptx` CLI | C# (.NET), single binary | [`office-cli/SKILL.md`](office-cli/SKILL.md), [`office-cli/CONTRIBUTING.md`](office-cli/CONTRIBUTING.md) |

Relationship:

- **aion-app** is the Electron / WebUI front end (main + renderer + preload).
- **aion-core** is the Rust HTTP/WebSocket backend the client talks to.
- **aionrs** is the embedded agent engine: multi-provider AI agent CLI / SDK (Anthropic, OpenAI, Bedrock, Vertex) with tools, MCP, skills, hooks, and memory. `aion-core` consumes its crates via a pinned git tag (`aion-core/Cargo.toml`); `AIONRS=<path> just _cargo` patches in this local checkout for development, and `just update-aionrs` bumps the pinned tag.
- **office-cli** creates and edits Office documents; AionUi integrates it for Office preview, skills, and assistants (`aionui-office` in core; builtin skills / assistants in app).

Upstream product repos (reference): [AionUi](https://github.com/iOfficeAI/AionUi), [AionCore](https://github.com/iOfficeAI/AionCore), [aionrs](https://github.com/iOfficeAI/aionrs), [OfficeCLI](https://github.com/iOfficeAI/OfficeCLI).

## Routing Rules

1. **Identify the owning package** before editing. Prefer a single-package change. Cross-package work needs an explicit plan covering API / skill / binary contracts on both sides.
2. **Follow the package `AGENTS.md`** (or OfficeCLI `SKILL.md` + `CONTRIBUTING.md`) for naming, architecture, tests, and push gates. Root rules below apply everywhere; package rules win on conflicts within that package.
3. **Do not invent a new top-level package** or move shared code to the workspace root without an explicit user request.
4. **Stay in scope.** Do not expand into cleanup, refactors, or sibling packages unless the user asks.

## Cross-Cutting Rules

### Verify before asserting

- Cite primary sources you read in this session (`path` or `path:line`). Sub-agent reports are leads, not facts — spot-check before repeating them.
- Never claim absence of a feature until you have searched and read the relevant handlers.
- Match tests to the claim: a green happy path does not prove tool streaming, permissions, AskUserQuestion, or other specialized flows.
- For cross-layer bugs (core → wire → app), trace the real payload through each hop; do not blame a layer by plausibility.
- Self-consistent local green ≠ correct. Prefer verification against a real agent / CLI capture or a known reference implementation when the change touches agent protocols.

### Agent CLI / protocol behavior

Never guess how agent CLIs (claude, codex, gemini, opencode, hermes, aionrs, …) behave. Claims about wire protocols, message shapes, or capabilities must come from approved sources (captures, ACP schema, official adapters, CLI `--help` / schemas, or recorded fixtures). See [`aion-core/AGENTS.md`](aion-core/AGENTS.md) for the full rule.

### Office documents

Prefer OfficeCLI (`office-cli`) over ad-hoc OpenXML / python-docx / openpyxl for create/edit/inspect. When unsure of syntax or properties, run `officecli help …` — do not guess. Strategy: L1 read → L2 DOM edit → L3 raw XML. See [`office-cli/SKILL.md`](office-cli/SKILL.md).

### Git & commits

- Do not push unless the user explicitly asks. In `aion-app`, `aion-core`, and `aionrs`, use `just push` instead of raw `git push`.
- Conventional Commits for app/core/rs: `<type>(<scope>): <subject>`.
- Never add AI signatures (`Co-Authored-By`, `Generated with`, etc.).
- OfficeCLI: one PR = one atomic change ([`office-cli/CONTRIBUTING.md`](office-cli/CONTRIBUTING.md)).

### Secrets & safety

- Never hardcode secrets, tokens, or API keys.
- Do not log prompts, tool I/O, file contents, or provider payloads in production-visible logs.

## Quick Commands

### aion-app

```bash
cd aion-app
bun install
bun start                 # Electron dev
bun run test              # Vitest
bun run lint:fix && bun run format
just push                 # when user asks to push
```

### aion-core

```bash
cd aion-core
cargo test -p aionui-<crate>          # during development
cargo clippy -p aionui-<crate> -- -D warnings
just push                             # when user asks to push (full gate)
# Avoid cargo test --workspace / clippy --workspace mid-task; they are slow.
# Develop against the local aionrs checkout instead of the pinned git tag:
#   AIONRS=../aionrs just _cargo test -p aionui-core
```

### aionrs

```bash
cd aionrs
cargo test -p aion-<crate>            # during development
cargo clippy -p aion-<crate> -- -D warnings
just push                             # when user asks to push (full gate)
```

### office-cli

```bash
cd office-cli
# Prefer installed binary + help over guessing APIs
officecli --version
officecli help
# Build: see office-cli/build.sh and README
```

## Where to Read Next

| Need | Go to |
| ---- | ----- |
| App conventions, IPC, i18n, UI | [`aion-app/AGENTS.md`](aion-app/AGENTS.md) |
| Core layers, API, DB, WS, tests | [`aion-core/AGENTS.md`](aion-core/AGENTS.md) |
| Core design background | [`aion-core/ARCHITECTURE.md`](aion-core/ARCHITECTURE.md) |
| Agent engine (aionrs) conventions, wire protocol | [`aionrs/AGENTS.md`](aionrs/AGENTS.md) |
| OfficeCLI usage for agents | [`office-cli/SKILL.md`](office-cli/SKILL.md) |
| OfficeCLI contribution rules | [`office-cli/CONTRIBUTING.md`](office-cli/CONTRIBUTING.md) |
