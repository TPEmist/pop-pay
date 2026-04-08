# Agent-Oriented Installation Guide

This guide is designed for AI agents (like Claude Code, OpenHands, or myself) to set up `pop-pay` autonomously.

## 1. Install Package
```bash
npm install pop-pay
```

## 2. Initialize Secure Vault
Run the vault initialization tool. This will prompt for credit card details (Number, Expiry, CVV) and store them in an AES-256-GCM encrypted file at `~/.config/pop-pay/vault.enc`.

```bash
npx pop-init-vault
```

## 3. Launch Browser Environment
Start a Chromium instance with the Chrome DevTools Protocol (CDP) enabled. This is required for DOM injection.

```bash
npx pop-launch --print-mcp
```

## 4. Integrate with MCP Host (Claude Code)
Add the `pop-pay` MCP server to your environment.

```bash
claude mcp add pop-pay -- npx pop-pay launch-mcp
```

## 5. Environment Variables
Configuration is managed via `~/.config/pop-pay/.env`. Key variables to check or set:

- `POP_ALLOWED_CATEGORIES`: e.g., `["aws", "cloudflare", "github"]`
- `POP_MAX_PER_TX`: Max amount per transaction (default: `100.0`)
- `POP_MAX_DAILY`: Max daily spend (default: `500.0`)
- `POP_GUARDRAIL_ENGINE`: `keyword` (fast) or `llm` (secure)
- `POP_CDP_URL`: Typically `http://localhost:9222`

## 6. Verification
The agent can verify the installation by calling the `page_snapshot` tool on any checkout page to ensure the security scanners are active.
