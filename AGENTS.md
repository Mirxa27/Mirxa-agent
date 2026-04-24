# Instructions for Coding Assistants

## Project Overview

This is a **monorepo** with npm workspaces:

- **Mirxa Agent** (`packages/mirxa-agent/`) - Main entry with built-in UI Panel, published as `mirxa-agent` on npm
- **Extension** (`packages/extension/`) - Browser extension (WXT + React)
- **Website** (`packages/website/`) - React docs and landing page. **When working on website, follow `packages/website/AGENTS.md`**

Internal packages:

- **Core** (`packages/core/`) - MirxaAgentCore without UI (npm: `@mirxa-agent/core`)
- **LLMs** (`packages/llms/`) - LLM client with reflection-before-action mental model
- **Page Controller** (`packages/page-controller/`) - DOM operations and visual feedback (SimulatorMask), independent of LLM
- **UI** (`packages/ui/`) - Panel and i18n. Decoupled from MirxaAgent

## Development Commands

```bash
npm start                      # Start website dev server
npm run build                  # Build all packages
npm run build:libs             # Build all libraries
npm run build:ext              # Build and zip the extension package
npm run typecheck              # Typecheck all packages
npm run lint                   # ESLint
```

## Architecture

### Monorepo Structure

Source-first monorepo: library `package.json` exports point to `src/*.ts` during development. At publish time, `scripts/pre-publish.js` promotes `publishConfig` fields to top-level (swapping to `dist/`), and `scripts/post-publish.js` restores the originals.

```
packages/
├── core/                    # npm: "@mirxa-agent/core" ⭐ Core agent logic (headless)
├── mirxa-agent/              # npm: "mirxa-agent" entry class (with UI + controller + demo builds)
├── website/                 # @mirxa-agent/website (private)
├── llms/                    # @mirxa-agent/llms
├── extension/               # Browser extension
├── page-controller/         # @mirxa-agent/page-controller
└── ui/                      # @mirxa-agent/ui
```

`workspaces` in `package.json` must be in topological order.

### Module Boundaries

- **Mirxa Agent**: Main entry with UI. Extends MirxaAgentCore and adds Panel. Imports from `@mirxa-agent/core`, `@mirxa-agent/ui`
- **Core**: MirxaAgentCore without UI. Imports from `@mirxa-agent/llms`, `@mirxa-agent/page-controller`
- **LLMs**: LLM client with MacroToolInput contract. No dependency on mirxa-agent
- **UI**: Panel and i18n. Decoupled from MirxaAgent via PanelAgentAdapter interface
- **Page Controller**: DOM operations with optional visual feedback (SimulatorMask). No LLM dependency. Enable mask via `enableMask: true` config

### PageController ↔ MirxaAgent Communication

All communication is async and isolated:

```typescript
// MirxaAgent delegates DOM operations to PageController
await this.pageController.updateTree()
await this.pageController.clickElement(index)
await this.pageController.inputText(index, text)
await this.pageController.scroll({ down: true, numPages: 1 })

// PageController exposes state via async methods
const simplifiedHTML = await this.pageController.getSimplifiedHTML()
const pageInfo = await this.pageController.getPageInfo()
```

### DOM Pipeline

1. **DOM Extraction**: Live DOM → `FlatDomTree` via `page-controller/src/dom/dom_tree/`
2. **Dehydration**: DOM tree → simplified text for LLM
3. **LLM Processing**: AI returns action plans (mirxa-agent)
4. **Indexed Operations**: MirxaAgent calls PageController by element index

## Key Files Reference

### Mirxa Agent (`packages/mirxa-agent/`)

| File               | Description                                  |
| ------------------ | -------------------------------------------- |
| `src/MirxaAgent.ts` | ⭐ Main class with UI, extends MirxaAgentCore |
| `src/demo.ts`      | IIFE demo entry (auto-init with demo API)    |

### Core (`packages/core/`)

| File                   | Description                             |
| ---------------------- | --------------------------------------- |
| `src/MirxaAgentCore.ts` | ⭐ Core agent class without UI          |
| `src/tools/`           | Tool definitions calling PageController |
| `src/config/`          | Configuration types and constants       |
| `src/prompts/`         | System prompt templates                 |

### LLMs (`packages/llms/`)

| File                  | Description                           |
| --------------------- | ------------------------------------- |
| `src/index.ts`        | ⭐ LLM class with retry logic         |
| `src/types.ts`        | MacroToolInput, AgentBrain, LLMConfig |
| `src/OpenAIClient.ts` | OpenAI-compatible client              |

### Page Controller (`packages/page-controller/`)

| File                        | Description                                                |
| --------------------------- | ---------------------------------------------------------- |
| `src/PageController.ts`     | ⭐ Main controller class with optional mask support        |
| `src/SimulatorMask.ts`      | Visual overlay blocking user interaction during automation |
| `src/actions.ts`            | Element interactions (click, input, scroll)                |
| `src/dom/dom_tree/index.js` | Core DOM extraction engine                                 |

## Adding New Features

### New Agent Tool

1. Implement in `packages/core/src/tools/index.ts`
2. If tool needs DOM ops, add method to PageController first
3. Tool calls `this.pageController.methodName()` for DOM interactions

### New PageController Action

1. Add implementation in `packages/page-controller/src/actions.ts`
2. Expose via async method in `PageController.ts`
3. Export from `packages/page-controller/src/index.ts`

## Code Standards

- Explicit typing for exported/public APIs
- ESLint relaxes some unsafe rules for rapid iteration
- Every change you make should not only implement the desired functionality but also improve the quality of the codebase
- All code and comments must be in English.
- Do not try to hide errors or risks. They are valuable feedbacks for developers and users. Make them visible and actionable.
- Traceability and predictability is more important than success rate.
