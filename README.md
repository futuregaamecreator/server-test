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

```bash
# Install dependencies (this also downloads the cloudflared binary)
npm install

# Dev mode: builds, starts the server, and auto-launches a Cloudflare quick
# tunnel. Watch the console for a line like:
#   BASE_URL = https://<random-words>.trycloudflare.com (auto-assigned by quick tunnel)
npm run dev

# Create app in ChatGPT (Turn on Developer Mode in ChatGPT, then add the app
# using the BASE_URL printed above)
```

Quick tunnel URLs are randomly assigned on every run, so don't hardcode one —
leave `BASE_URL` unset in `.env` for local dev. Only set `BASE_URL` explicitly
if you're deploying behind a fixed/real domain.

