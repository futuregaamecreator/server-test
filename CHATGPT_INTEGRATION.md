# ChatGPT Integration Guide

## How to Make Your Cricket MCP Server Discoverable in ChatGPT

### Option 1: Custom ChatGPT Action (Easiest)

1. **Go to ChatGPT and create a Custom GPT**:
   - Click "Create" → "New GPT"
   - Name: "Cricket Wireless Assistant"
   - Add this in the instructions:
     ```
     You are a Cricket Wireless sales assistant. Help users find the right prepaid mobile plan, check service coverage, and verify device compatibility.
     ```

2. **Add the HTTP Action**:
   - In your GPT settings, go to "Actions"
   - Click "Create new action"
   - Select "HTTP" as the API type
   - Add endpoint: `https://voip-repairs-independent-posing.trycloudflare.com/mcp`
   - Method: `POST`
   - Headers: `Content-Type: application/json`, `mcp-session-id: {{sessionId}}`

3. **Share the Custom GPT link** with users

---

### Option 2: Official OpenAI Integration (More Complex)

1. **Submit to OpenAI's GPT Store**:
   - Your MCP server must be publicly accessible
   - Fill out OpenAI's integration form
   - Provide keywords and description from `manifest.json`

2. **Required files**:
   - ✅ `manifest.json` - Already created
   - `README.md` - Instructions for users
   - Logo/icon in `public/` folder

---

### Option 3: Direct MCP Connection (For Teams)

Users can connect directly to your MCP server in ChatGPT:

1. Go to ChatGPT settings
2. Select "Connect to MCP"
3. Enter your tunnel URL: `https://voip-repairs-independent-posing.trycloudflare.com/mcp`
4. Select which tools to enable

---

## Keywords That Help Discovery

Your MCP server is now indexed with these keywords:

- **Service Keywords**: cricket wireless, mobile plans, prepaid, cell phone, telecom
- **Feature Keywords**: coverage, pricing, plans, wireless service, phone plans
- **Action Keywords**: compare, check, verify, browse

When users search/"ask ChatGPT for:
- "Cricket Wireless plans"
- "Check my phone compatibility"
- "Cricket coverage in my area"
- "Compare prepaid mobile plans"

Your MCP should appear in results.

---

## Env Configuration

Make sure your `.env` has:

```
PORT=8000
BASE_URL=https://voip-repairs-independent-posing.trycloudflare.com
```

---

## Testing

Test your MCP locally:

```bash
npm run dev
```

Then test with curl:

```bash
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0"}
    },
    "id": 1
  }'
```

---

## Recommended Next Steps

1. ✅ Update server keywords (Done)
2. ✅ Create manifest.json (Done)
3. Create a professional README.md
4. Add a logo to `public/logo.png`
5. Test with curl/Postman
6. Deploy consistently with your tunnel
7. Submit to OpenAI if pursuing official integration

---

## Useful Links

- [MCP Spec](https://spec.modelcontextprotocol.io/)
- [OpenAI MCP Integration](https://openai.com/blog/introducing-model-context-protocol)
- [ChatGPT Custom Actions](https://openai.com/help/articles/8554329-create-custom-gpts)
