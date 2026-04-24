# Mirxa Agent

> The GUI agent that lives inside your webpage. Control any web UI with natural language — no extension, no headless browser, no Python.

[![License: MIT](https://img.shields.io/badge/License-MIT-auto.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![GitHub stars](https://img.shields.io/github/stars/Mirxa27/Mirxa-agent.svg)](https://github.com/Mirxa27/Mirxa-agent)

🌐 **English** | [中文](./docs/README-zh.md)

---

## What is Mirxa Agent?

Mirxa Agent is an embedded, in-page GUI agent for web applications. You drop it into any site and your users can drive the UI with plain language ("fill out this form", "find me a flight to Tokyo next Friday under $800", "export the last 30 days of orders to CSV"). It works by reading the live DOM, asking an LLM what to do next, and clicking / typing / scrolling on real elements — all from within the page itself.

**Why it's different**

- **No infrastructure** — pure in-page JavaScript. No browser extension, no headless browser, no backend service.
- **Text-based DOM** — uses a structured DOM representation, not screenshots. Works with any text-only LLM.
- **Bring your own LLM** — any OpenAI-compatible endpoint (OpenAI, Anthropic via proxy, Qwen, DeepSeek, local Ollama, vLLM, etc.).
- **Built-in panel UI** — ready-to-use chat panel with provider config, file uploads, and history.
- **Optional Chrome extension** for cross-tab tasks, plus an MCP server to drive the browser from outside.

## Quick Start

### Option 1 — Try it instantly (script tag)

```html
<script src="https://cdn.jsdelivr.net/npm/mirxa-agent@1.8.0/dist/iife/mirxa-agent.demo.js" crossorigin="true"></script>
```

Drop the line above into any HTML page and you'll see the Mirxa Agent panel appear in the corner. The demo build ships with a public testing LLM so you can try it without an API key.

> ⚠️ The bundled testing endpoint is for evaluation only. For production, configure your own provider (next section).

### Option 2 — Install via npm

```bash
npm install mirxa-agent
```

```ts
import { MirxaAgent } from 'mirxa-agent'

const agent = new MirxaAgent({
    baseURL: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
    language: 'en-US',
})

await agent.execute('Click the login button and sign in as guest')
```

That's it — the agent renders a panel into the document and is ready to take instructions either programmatically (`agent.execute(...)`) or from the user via the panel input.

## Configure your LLM provider

Mirxa Agent talks to any OpenAI-compatible `/v1/chat/completions` endpoint. Common setups:

| Provider             | `baseURL`                                              | Example `model`         |
| -------------------- | ------------------------------------------------------ | ----------------------- |
| OpenAI               | `https://api.openai.com/v1`                            | `gpt-4o-mini`           |
| Anthropic (proxy)    | your proxy URL                                         | `claude-3-5-sonnet`     |
| Alibaba DashScope    | `https://dashscope.aliyuncs.com/compatible-mode/v1`    | `qwen3.5-plus`          |
| DeepSeek             | `https://api.deepseek.com/v1`                          | `deepseek-chat`         |
| Local Ollama         | `http://localhost:11434/v1`                            | `llama3.1`              |
| vLLM / LM Studio     | `http://localhost:8000/v1`                             | _your served model_     |

You can also configure the provider, API key, and model interactively from the **Settings** panel inside the agent UI — including auto-fetching the available models list from the provider's `/v1/models` endpoint.

## Settings panel features

The in-page panel exposes everything end-users need without code changes:

- **Provider config** — `baseURL`, `apiKey`, `model` selector with one-click "Fetch models" against `GET {baseURL}/models`.
- **File manager** — upload reference files (text, JSON, CSV, markdown, etc.) that the agent can read while performing tasks. Stored locally in IndexedDB; never sent unless the agent decides to read one.
- **Language** — UI language toggle.
- **Persisted to `localStorage`** — settings survive reloads.

To use uploaded files in a task, the agent has built-in tools `list_attached_files` and `read_attached_file` that surface the file metadata and content. Just reference a file by name in your prompt: _"Use `customers.csv` and write a summary of churn by region"_.

## Optional: Chrome extension & MCP server

For multi-tab automation or driving the browser from outside (e.g. an external agent over MCP):

- **Extension** — see [`packages/extension`](packages/extension/) — provides a side-panel agent that controls every tab.
- **MCP server** — see [`packages/mcp`](packages/mcp/) — exposes the extension over the Model Context Protocol so any MCP-aware client (Claude Desktop, Cursor, etc.) can drive your browser.

Full docs: <https://Mirxa27.github.io/Mirxa-agent/>

## Repository layout

This is an npm-workspaces monorepo:

```
packages/
├── mirxa-agent/        # main npm package — MirxaAgent (panel + controller + demo)
├── core/               # @mirxa-agent/core — headless MirxaAgentCore
├── llms/               # @mirxa-agent/llms — OpenAI-compatible LLM client
├── page-controller/    # @mirxa-agent/page-controller — DOM ops + visual feedback
├── ui/                 # @mirxa-agent/ui — Panel + i18n
├── extension/          # @mirxa-agent/ext — Chrome extension (WXT + React)
├── mcp/                # @mirxa-agent/mcp — MCP server
└── website/            # @mirxa-agent/website — docs site
```

## Development

```bash
# install everything
npm install

# typecheck the whole monorepo
npm run typecheck

# lint
npm run lint

# build all libraries (parallel)
npm run build:libs

# website dev server
npm start

# build the extension
npm run build:ext

# extension dev mode (loads into a chrome profile)
npm run dev:ext
```

Requires Node `>= 22.13` (the engines field warns on lower versions but most workflows still work on 20.x).

See [`AGENTS.md`](AGENTS.md) for the architecture overview and [`CONTRIBUTING.md`](CONTRIBUTING.md) for contribution guidelines.

## License

[MIT](LICENSE)

## Acknowledgments

DOM processing components and the agent prompt structure are derived from [`browser-use`](https://github.com/browser-use/browser-use) (MIT, © 2024 Gregor Zunic). Mirxa Agent is targeted at **client-side web enhancement** rather than server-side scraping — but the underlying techniques are very much built on browser-use's shoulders.
