[![npm version](https://img.shields.io/npm/v/pop-pay.svg)](https://www.npmjs.com/package/pop-pay) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![CI](https://github.com/TPEmist/pop-pay/actions/workflows/ci.yml/badge.svg)](https://github.com/TPEmist/pop-pay/actions/workflows/ci.yml) [![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

<p align="center">
    <picture>
        <img src="https://raw.githubusercontent.com/TPEmist/Point-One-Percent/main/project_banner.png" alt="Point One Percent (AgentPay)" width="800">
    </picture>
</p>

# Point One Percent — pop-pay
<p align="left"><i>it only takes <b>0.1%</b> of Hallucination to drain <b>100%</b> of your wallet.</i></p>

The runtime security layer for AI agent commerce. Card credentials are injected directly into the browser DOM via CDP — they never enter the agent's context window. One hallucinated prompt can't drain a wallet it can't see.

## Getting Started

Add pop-pay to your MCP client config:

```json
{
  "mcpServers": {
    "pop-pay": {
      "command": "npx",
      "args": ["-y", "pop-pay", "launch-mcp"],
      "env": {
        "POP_CDP_URL": "http://localhost:9222",
        "POP_ALLOWED_CATEGORIES": "[\"aws\",\"cloudflare\"]",
        "POP_MAX_PER_TX": "100.0",
        "POP_MAX_DAILY": "500.0",
        "POP_GUARDRAIL_ENGINE": "keyword"
      }
    }
  }
}
```

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20MCP%20Server&color=0098FF" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522pop-pay%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522pop-pay%2522%252C%2522launch-mcp%2522%255D%252C%2522env%2522%253A%257B%2522POP_CDP_URL%2522%253A%2522http%253A%252F%252Flocalhost%253A9222%2522%257D%257D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20MCP%20Server&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522pop-pay%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522pop-pay%2522%252C%2522launch-mcp%2522%255D%252C%2522env%2522%253A%257B%2522POP_CDP_URL%2522%253A%2522http%253A%252F%252Flocalhost%253A9222%2522%257D%257D) [<img src="https://img.shields.io/badge/Cursor-Cursor?style=flat-square&label=Install%20MCP%20Server&color=5C2D91" alt="Install in Cursor">](cursor://anysphere.cursor-deeplink/mcp/install?name=pop-pay&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInBvcC1wYXkiLCJsYXVuY2gtbWNwIl0sImVudiI6eyJQT1BfQ0RQX1VSTCI6Imh0dHA6Ly9sb2NhbGhvc3Q6OTIyMiJ9fQ==)

<details>
<summary>Claude Code</summary>

```bash
claude mcp add pop-pay -- npx -y pop-pay launch-mcp
```

With environment variables:

```bash
claude mcp add pop-pay \
  -e POP_CDP_URL=http://localhost:9222 \
  -e POP_ALLOWED_CATEGORIES='["aws","cloudflare"]' \
  -e POP_MAX_PER_TX=100.0 \
  -e POP_MAX_DAILY=500.0 \
  -e POP_GUARDRAIL_ENGINE=keyword \
  -- npx -y pop-pay launch-mcp
```

</details>

<details>
<summary>Cursor</summary>

Add to `~/.cursor/mcp.json` using the standard config block above.

</details>

<details>
<summary>Windsurf</summary>

Add to `~/.codeium/windsurf/mcp_config.json` using the standard config block above.

</details>

<details>
<summary>VS Code (Copilot)</summary>

Add to `.vscode/mcp.json` in your project root using the standard config block above.

</details>

<details>
<summary>OpenClaw / NemoClaw</summary>

Compatible with any MCP host. See the [Integration Guide](./docs/INTEGRATION_GUIDE.md) for setup instructions and System Prompt templates.

</details>

<details>
<summary>Docker</summary>

```bash
docker-compose up -d
```

Runs the MCP server + headless Chromium with CDP. Mount your encrypted vault from the host. See `docker-compose.yml` for configuration.

</details>

## Vault Setup

Credentials are stored in an AES-256-GCM encrypted vault — plaintext card data never touches disk.

```bash
npx pop-init-vault
```

**Passphrase mode** (recommended — protects against agents with shell access):

```bash
npx pop-init-vault --passphrase   # one-time setup
npx pop-unlock                     # run once before each MCP session
```

`pop-unlock` derives the key from your passphrase and stores it in the OS keyring. The MCP server reads it automatically at startup.

## MCP Tools

| Tool | Description |
|:---|:---|
| `request_virtual_card` | Issue a virtual card and inject credentials into the checkout page via CDP. |
| `request_purchaser_info` | Auto-fill billing/contact info (name, address, email, phone). |
| `request_x402_payment` | Pay for API calls via the x402 HTTP payment protocol. |
| `page_snapshot` | Scan a checkout page for hidden prompt injections or anomalies. |

## Configuration

Core variables in `~/.config/pop-pay/.env`. See [ENV_REFERENCE.md](./docs/ENV_REFERENCE.md) for the full list.

| Variable | Default | Description |
|---|---|---|
| `POP_ALLOWED_CATEGORIES` | `["aws","cloudflare"]` | Approved vendor categories — see [Categories Cookbook](./docs/CATEGORIES_COOKBOOK.md) |
| `POP_MAX_PER_TX` | `100.0` | Max USD per transaction |
| `POP_MAX_DAILY` | `500.0` | Max USD per day |
| `POP_BLOCK_LOOPS` | `true` | Block hallucination/retry loops |
| `POP_AUTO_INJECT` | `true` | Enable CDP card injection |
| `POP_GUARDRAIL_ENGINE` | `keyword` | `keyword` (zero-cost) or `llm` (semantic) |

### Guardrail Mode

| | `keyword` (default) | `llm` |
|---|---|---|
| **Mechanism** | Keyword matching on reasoning string | Semantic analysis via LLM |
| **Cost** | Zero — no API calls | One LLM call per request |
| **Best for** | Development, low-risk workflows | Production, high-value transactions |

> To enable LLM mode, see [Integration Guide §1](./docs/INTEGRATION_GUIDE.md#guardrail-mode-configuration).

## Providers

| Provider | Description |
|:---|:---|
| **BYOC** (default) | Bring Your Own Card — encrypted vault credentials, local CDP injection. |
| **Stripe Issuing** | Real virtual cards via Stripe API. Requires `POP_STRIPE_KEY`. |
| **Lithic** | Multi-issuer adapter (Stripe Issuing / Lithic). |
| **Mock** | Test mode with generated card numbers for development. |

**Priority:** Stripe Issuing → BYOC Local → Mock.

## Security

| Layer | Defense |
|---|---|
| **Context Isolation** | Card credentials never enter the agent's context window or logs |
| **Encrypted Vault** | AES-256-GCM with XOR-split salt and native scrypt key derivation (Rust) |
| **TOCTOU Guard** | Domain verified at the moment of CDP injection — blocks redirect attacks |
| **Repr Redaction** | Automatic masking (`****-4242`) in all MCP responses, logs, and tracebacks |

See [THREAT_MODEL.md](./docs/THREAT_MODEL.md) for the full STRIDE analysis and [COMPLIANCE_FAQ.md](./docs/COMPLIANCE_FAQ.md) for enterprise details.

## Architecture

- **TypeScript** — MCP server, CDP injection engine, guardrails, CLI
- **Rust (napi-rs)** — Native security layer: XOR-split salt storage, scrypt key derivation
- **Node.js crypto** — AES-256-GCM vault encryption (OpenSSL binding)
- **Chrome DevTools Protocol** — Direct DOM injection via raw WebSocket

## Documentation

- [Threat Model](docs/THREAT_MODEL.md) — STRIDE analysis, 5 security primitives, 10 attack scenarios
- [Guardrail Benchmark](docs/GUARDRAIL_BENCHMARK.md) — 95% accuracy across 20 test scenarios
- [Compliance FAQ](docs/COMPLIANCE_FAQ.md) — PCI DSS, SOC 2, GDPR details
- [Environment Reference](docs/ENV_REFERENCE.md) — All POP_* environment variables
- [Integration Guide](docs/INTEGRATION_GUIDE.md) — Setup for Claude Code, Node.js SDK, and browser agents
- [Categories Cookbook](docs/CATEGORIES_COOKBOOK.md) — POP_ALLOWED_CATEGORIES patterns and examples

## License

MIT
