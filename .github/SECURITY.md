# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |

## How It Works

This MCP server acts as a bridge between AI assistants and the Apple Search Ads API. It makes API calls on behalf of the user using credentials they provide via environment variables.

**Important:**
- The server **never stores** your credentials — they are read from environment variables or local config files at startup.
- Authentication tokens are cached in memory only and are never written to disk.
- All communication with Apple's API uses HTTPS.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, use **GitHub's private vulnerability reporting**:

1. Go to the [Security tab](../../security) of this repository
2. Click **"Report a vulnerability"**
3. Include a description of the vulnerability, steps to reproduce, and any potential impact

You should receive a response within 48 hours. If the issue is confirmed, a fix will be released as soon as possible with credit to the reporter (unless anonymity is preferred).
