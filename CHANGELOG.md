# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.3] - 2026-04-09

### Fixed
- Card injection in Stripe multi-iframe layouts (Zoho Checkout). Fields are now filled independently across sibling iframes instead of requiring all fields in a single frame.

### Changed
- Removed `page_snapshot` as standalone MCP tool. Security scan is now automatically embedded in `request_virtual_card` and `request_purchaser_info`.
- MCP server exposes 3 tools (was 4): `request_virtual_card`, `request_purchaser_info`, `request_x402_payment`.

## [0.2.0] - 2026-04-05

### Added
- Major documentation overhaul with professional MCP standards.
- Platform setup guides for Claude Code, Cursor, Windsurf, and VS Code.
- Status badges (npm, License, CI, Node.js) to README.

## [0.1.2] - 2026-04-04

### Changed
- Hardened CI workflows with environment protection and explicit permissions.
- Moved salt injection to environment variables for improved security.

## [0.1.1] - 2026-04-04

### Added
- Automated npm publish workflow using OIDC trusted publishing.
- Repository metadata and `.npmignore` configuration.

## [0.1.0] - 2026-04-03

### Added
- Initial TypeScript + Rust port from the Python repository.
- **MCP Server**: Full Model Context Protocol implementation.
- **CDP Injection Engine**: Advanced DOM traversal supporting iframes and Shadow DOM.
- **CLI Commands**:
  - `pop-launch`: Starts Chrome with CDP and MCP.
  - `pop-init-vault`: Securely initializes the encrypted credential vault.
  - `pop-unlock`: Unlocks the vault using the OS keyring.
- **Security**: AES-256-GCM encryption for credentials and Rust native layer via napi-rs.
- **Testing**: Comprehensive suite with 170+ tests covering SSRF, TOCTOU, and vault interop.
- **Docker**: Containerized setup with headless Chromium.
- **New Tools**: Added `page_snapshot` for security scanning of checkout pages.
