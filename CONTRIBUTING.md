# Contributing

Thanks for your interest in contributing to Apple Ads MCP!

## Setup

```bash
git clone https://github.com/javiergalloroca/AppleAdsMCP.git
cd AppleAdsMCP
npm install
```

## Development

```bash
npm run dev    # Run with tsx (hot reload)
npm run build  # Compile TypeScript
npm start      # Run compiled output
```

## TypeScript Conventions

- **Strict mode** is enabled
- **ESM** — the project uses `"type": "module"` in package.json
- All imports must use **`.js` extensions** (e.g., `import { foo } from './bar.js'`)
- Target: ES2022, module resolution: Node16

## Adding a New Tool

1. Create or edit a file in `src/tools/`
2. Export a `registerXTools(server: McpServer, client: AppleAdsClient)` function
3. Use `server.tool(name, description, zodSchema, handler)` to register the tool
4. Import and call the register function in `src/index.ts`
5. The handler should return `{ content: [{ type: "text", text: string }] }`

See existing tools in `src/tools/` for examples.

## Pull Requests

- **Build must pass** — run `npm run build` before submitting
- **Describe your changes** — explain what and why
- **One concern per PR** — keep changes focused

## Reporting Issues

Use [GitHub Issues](https://github.com/javiergalloroca/AppleAdsMCP/issues) for bugs and feature requests. For security issues, see [SECURITY.md](.github/SECURITY.md).
