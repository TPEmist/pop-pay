#!/bin/bash

# Setup script for pop-pay with Claude Code
# This script initializes the vault and configures the MCP server.

set -e

echo "--- Initializing pop-pay Vault ---"
# This will prompt for card details and encrypt them
npx pop-init-vault

echo ""
echo "--- Launching Chrome with CDP ---"
# Launches Chrome with remote debugging enabled on port 9222
# The --print-mcp flag shows the commands for different platforms
npx pop-launch --print-mcp &

# Wait a moment for Chrome to start
sleep 3

echo ""
echo "--- Adding MCP Server to Claude Code ---"
# Adds pop-pay as a global MCP server for Claude Code
claude mcp add pop-pay --scope user -- npx pop-pay launch-mcp

echo ""
echo "Setup Complete!"
echo "You can now ask Claude Code to make purchases within your configured policy."
echo "Check ~/.config/pop-pay/.env to configure spending limits."
