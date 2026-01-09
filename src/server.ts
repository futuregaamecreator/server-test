// src/server.ts
import "dotenv/config";

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

// --------------------------------------------------
// Config
// --------------------------------------------------

const PORT = Number(process.env.PORT ?? 8000);
const BASE_URL = (process.env.BASE_URL ?? "").replace(/\/$/, "");

if (!BASE_URL) {
  console.warn(
    '[WARN] BASE_URL not set. Widget assets will NOT load in ChatGPT iframe.\n' +
    'Example: BASE_URL="https://<your-tunnel>.trycloudflare.com"'
  );
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function guessMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "application/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".ico": return "image/x-icon";
    default: return "application/octet-stream";
  }
}

function isTextMime(mime: string) {
  return (
    mime.startsWith("text/") ||
    mime.includes("javascript") ||
    mime.includes("json") ||
    mime.includes("svg")
  );
}

/**
 * Maps a URL (from registerResource callback) to a local file path
 */
function uriToLocalPath(uri: string): string {
  let pathname: string;

  try {
    pathname = new URL(uri).pathname;
  } catch {
    pathname = uri;
  }

  if (!pathname.startsWith("/public/")) {
    throw new Error(`Blocked resource path: ${pathname}`);
  }

  const local = path.join(process.cwd(), pathname.slice(1));
  const normalized = path.normalize(local);
  const root = path.normalize(process.cwd() + path.sep);

  if (!normalized.startsWith(root)) {
    throw new Error(`Path traversal attempt: ${uri}`);
  }

  return normalized;
}

// --------------------------------------------------
// Widget HTML loader (your working approach)
// --------------------------------------------------

function loadWidgetHtml(): string {
  const htmlPath = path.join(process.cwd(), "public", "widget", "index.html");
  let html = fs.readFileSync(htmlPath, "utf8");

  if (!BASE_URL) return html;

  html = html.replaceAll(
    'src="/public/widget/',
    `src="${BASE_URL}/public/widget/`
  );
  html = html.replaceAll(
    'href="/public/widget/',
    `href="${BASE_URL}/public/widget/`
  );

  return html;
}

// --------------------------------------------------
// MCP Server Factory
// --------------------------------------------------

function createCricketServer() {
  const server = new McpServer({
    name: "cricket-sales-app",
    version: "1.0.0"
  });

  // ----------------------------
  // Widget HTML resource
  // ----------------------------
  server.registerResource(
    "cricket-widget-html",
    "ui://widget/cricket/index.html",
    {},
    async () => ({
      contents: [
        {
          uri: "ui://widget/cricket/index.html",
          mimeType: "text/html",
          text: loadWidgetHtml()
        }
      ]
    })
  );

  // ----------------------------
  // Widget static assets
  // ----------------------------
  server.registerResource(
    "widget-assets",
    "/public/widget/**",
    { description: "Cricket widget static assets" },
    async (uri: URL) => {
      const assetPath = uriToLocalPath(uri.href);
      const mimeType = guessMimeType(assetPath);

      if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
        return { contents: [] };
      }

      const buf = fs.readFileSync(assetPath);

      if (isTextMime(mimeType)) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType,
              text: buf.toString("utf8")
            }
          ]
        };
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType,
            blob: buf.toString("base64"),
            _meta: { encoding: "base64" }
          }
        ]
      };
    }
  );

  // ----------------------------
  // Tool: View Plans
  // ----------------------------
  server.registerTool(
  "cricket_view_plans",
  {
    title: "Cricket: View plans",
    description: "Show Cricket Wireless plans.",
    inputSchema: {
      recommendedPlanId: z.string().optional(),
    },
    _meta: {
      "openai/outputTemplate": "ui://widget/cricket/index.html",
    },
  },
  async (args) => {
    const plans = [
      {
        id: "10gb",
        name: "10GB Plan",
        price: 40,
        description: "10GB high-speed data + unlimited talk & text.",
        bestFor: "Light users and budget shoppers.",
      },
      {
        id: "unlimited_core",
        name: "Unlimited Core",
        price: 55,
        description: "Unlimited data + hotspot included.",
        bestFor: "Most customers and everyday streaming.",
      },
      {
        id: "unlimited_more",
        name: "Unlimited More",
        price: 60,
        description: "Premium unlimited + more hotspot for power users.",
        bestFor: "Travel, hotspot, and heavy data use.",
      },
    ];

    return {
      content: [{ type: "text", text: "Showing Cricket plans." }],
      structuredContent: {
        view: "plans",
        plans,
        recommendedPlanId: args?.recommendedPlanId ?? "unlimited_more",
      },
    };
  }
);


  return server;
}

// --------------------------------------------------
// HTTP + MCP transport
// --------------------------------------------------

const transports: Record<string, StreamableHTTPServerTransport> = {};

async function main() {
  const app = express();

  app.use(cors({
    origin: "*",
    exposedHeaders: ["Mcp-Session-Id"],
    allowedHeaders: ["Content-Type", "mcp-session-id"]
  }));

  app.use(express.json({ limit: "2mb" }));
  app.use("/public", express.static("public"));

  app.get("/", (_req, res) => {
    res.send("Cricket MCP server running");
  });

  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
        }
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
        }
      };

      const server = createCricketServer();
      await server.connect(transport);
    } else {
      return res.status(400).json({ error: "Invalid MCP session" });
    }

    await transport.handleRequest(req, res, req.body);
  });

  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string;
    const transport = transports[sessionId];
    if (!transport) return res.status(404).send("Session not found");
    await transport.handleRequest(req, res);
  });

  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string;
    const transport = transports[sessionId];
    if (!transport) return res.status(404).send("Session not found");
    await transport.handleRequest(req, res);
  });

  app.listen(PORT, () => {
    console.log(`MCP server running at http://localhost:${PORT}/mcp`);
    console.log(`Widget test: http://localhost:${PORT}/public/widget/index.html`);
    console.log(`BASE_URL = ${BASE_URL || "(not set)"}`);
  });
}

main().catch(err => {
  console.error("Server failed to start", err);
  process.exit(1);
});
