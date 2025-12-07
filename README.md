# server-test
Testing MCP Servers
# Cricket Wireless ChatGPT App (MCP Server)

Sales-focused Cricket Wireless assistant for ChatGPT.  
Helps users:

- View and compare Cricket plans
- Check coverage by ZIP
- Check device compatibility (IMEI)
- See promotions and deals

## Prerequisites

- Node.js 18+
- npm, pnpm, or yarn
- Access to ChatGPT with support for Apps / MCP

## Install & Run
# Install cloudflared
brew install cloudflared

```bash
# Install dependencies
npm install

# Dev mode (TypeScript via ts-node)
npm run dev

#Run cloudfare tunnel
cloudflared tunnel --url http://localhost:8000

#create app in ChatGPT app (Turn on Developer Mode in Chat GPT then add app with cloud flare url)

