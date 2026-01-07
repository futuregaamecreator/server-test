// src/server.ts
import "dotenv/config";

import express, { Request, Response } from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { z } from "zod";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

// If your cricketData is TS, this import might be "./cricketData.js" after build.
// Keep it aligned with how you currently import it elsewhere.
import {
  PLANS,
  type CricketPlanId,
  checkCoverage,
  checkDeviceCompatibility,
  getPromotions
} from "./cricketData.js";



import fs from "fs";
import path from "path";

import { fileURLToPath } from "url";

const BASE_URL = process.env.BASE_URL?.replace(/\/$/, "") ?? ""; // no trailing slash
function guessMimeType(p: string): string {
  const ext = path.extname(p).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}


function uriToLocalDistPath(uri: string): string {
  // uri could be absolute (https://...) or relative (/public/...)
  let pathname: string;

  try {
    // If absolute URL
    pathname = new URL(uri).pathname;
  } catch {
    // If relative
    pathname = uri;
  }

  // Ensure it starts with /public/
  if (!pathname.startsWith("/public/")) {
    throw new Error(`Unsupported resource path: ${pathname}`);
  }

  // Map to local filesystem under your project root
  const localPath = path.join(process.cwd(), pathname.slice(1)); // remove leading "/"

  // Prevent "../" traversal escaping the project folder
  const normalized = path.normalize(localPath);
  const root = path.normalize(process.cwd() + path.sep);
  if (!normalized.startsWith(root)) {
    throw new Error(`Blocked path traversal: ${uri}`);
  }

  return normalized;
}

function isTextMime(mime: string): boolean {
  return (
    mime.startsWith("text/") ||
    mime.includes("javascript") ||
    mime.includes("json") ||
    mime.includes("svg+xml")
  );
}


export function loadWidgetHtml(): string {
  const htmlPath = path.join(process.cwd(), "public", "widget", "index.html");
  let html = fs.readFileSync(htmlPath, "utf8");

  if (!BASE_URL) {
    // If BASE_URL is missing, root-relative URLs (/assets/...) will break inside the iframe.
    // You can either throw to catch misconfig early, or just return as-is.
    // I'd rather fail loudly:
    throw new Error("BASE_URL is not set. Cannot rewrite widget asset URLs for iframe rendering.");
  }

  // 1) Remove/override any <base href="/"> which would break relative URL resolution in an iframe context.
  // If you want, you can set it to BASE_URL + "/public/widget/" instead.
  html = html.replace(
    /<base\s+href=["'][^"']*["']\s*\/?>/i,
    `<base href="${BASE_URL}/public/widget/">`
  );

  // 2) Rewrite common Vite asset URL patterns to absolute URLs.
  // Covers:
  //  - /public/widget/...
  //  - /assets/...
  //  - ./assets/...
  //  - assets/...
  //
  // We map them all to:  ${BASE_URL}/public/widget/...
  //
  // NOTE: If your build output is NOT under /public/widget/, adjust this prefix once.
  const ABS_PREFIX = `${BASE_URL}/public/widget/`;

  // /public/widget/...
  html = html.replaceAll('src="/public/widget/', `src="${ABS_PREFIX}`);
  html = html.replaceAll('href="/public/widget/', `href="${ABS_PREFIX}`);

  // /assets/...  -> /public/widget/assets/...
  html = html.replaceAll('src="/assets/', `src="${ABS_PREFIX}assets/`);
  html = html.replaceAll('href="/assets/', `href="${ABS_PREFIX}assets/`);

  // ./assets/... -> /public/widget/assets/...
  html = html.replaceAll('src="./assets/', `src="${ABS_PREFIX}assets/`);
  html = html.replaceAll('href="./assets/', `href="${ABS_PREFIX}assets/`);

  // assets/... -> /public/widget/assets/...
  html = html.replaceAll('src="assets/', `src="${ABS_PREFIX}assets/`);
  html = html.replaceAll('href="assets/', `href="${ABS_PREFIX}assets/`);

  return html;
}






/**
 * Creates a fresh MCP server instance and registers all tools + the widget resource.
 * One instance per MCP session.
 */
function createCricketServer() {
  const server = new McpServer({
    name: "cricket-sales-app",
    version: "0.2.0"
  });

  // Widget resource (Vite-built HTML + external assets)
server.registerResource(
  "cricket-widget-html",
  "ui://widget/cricket/index.html",
  {},
  async () => {
    const html = loadWidgetHtml(); // returns the final HTML string
    return {
      contents: [{
        uri: "ui://widget/cricket/index.html",
        mimeType: "text/html",
        text: html,
      }],
    };
  }
);

server.registerResource(
  "widget-assets",
  "/public/widget/**", // keep whatever string you were using; this overload will now match
  { description: "Cricket widget static assets" },
  async (uri: URL ) => {
    const assetPath = uriToLocalDistPath(uri.href);
    const mimeType = guessMimeType(assetPath);

    if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
      return { contents: [] };
    }

    const buf = fs.readFileSync(assetPath);

    // Return TEXT for js/css/html/svg/etc (this avoids the blob typing issues entirely)
    if (isTextMime(mimeType)) {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType,
            text: buf.toString("utf8"),
          },
        ],
      };
    }

    // Return BASE64 for binary files
    return {
      contents: [
        {
          uri: uri.href,
          mimeType,
          blob: buf.toString("base64"),
          _meta: { encoding: "base64" },
        },
      ],
    };
  }
);



  // ----------------------------
  // TOOLS
  // ----------------------------

  // Plans tool (renders widget)
  server.registerTool(
    "cricket_view_plans",
    {
      title: "Cricket: view plans",
      description: "Show Cricket Wireless plans and help the user pick one.",
      inputSchema: {
        recommendedPlanId: z
          .enum(["10gb", "unlimited_core", "unlimited_more"])
          .optional()
          .describe("Optional preselected plan to highlight for the user.")
      },
      _meta: {
        "openai/outputTemplate": "ui://widget/cricket-plans-inline-v3.html",
        "openai/toolInvocation/invoking": "Loading Cricket Wireless plans…",
        "openai/toolInvocation/invoked": "Cricket plans loaded."
      }
    },
    async ({ recommendedPlanId }: { recommendedPlanId?: CricketPlanId }) => {
      const recommended = (recommendedPlanId ??
        "unlimited_more") as CricketPlanId;

      return {
        content: [
          {
            type: "text",
            text: `Showing Cricket Wireless plans. Recommended: ${recommended}.`
          }
        ],
        structuredContent: {
          view: "plans",
          recommendedPlanId: recommended,
          plans: PLANS
        }
      };
    }
  );

  // Coverage tool
  server.tool(
    "cricket_check_coverage",
    "Check Cricket coverage for a given ZIP code.",
    {
      zip: z
        .string()
        .min(3, "ZIP code seems too short")
        .max(10, "ZIP code seems too long")
    },
    async ({ zip }) => {
      const result = checkCoverage(zip);

      return {
        content: [{ type: "text", text: `Coverage in ${zip}: ${result.quality}.` }],
        structuredContent: {
          view: "coverage",
          coverage: result
        }
      };
    }
  );

  // Device compatibility tool
  server.tool(
    "cricket_check_device",
    "Check if a device is compatible using IMEI.",
    {
      imei: z
        .string()
        .min(8, "IMEI seems too short")
        .max(20, "IMEI seems too long")
    },
    async ({ imei }) => {
      const result = checkDeviceCompatibility(imei);

      return {
        content: [{ type: "text", text: result.message }],
        structuredContent: {
          view: "device",
          device: result
        }
      };
    }
  );

  // Promotions tool
  server.tool(
    "cricket_promotions",
    "Show current Cricket promotions, optionally filtered by plan.",
    {
      planId: z.enum(["10gb", "unlimited_core", "unlimited_more"]).optional()
    },
    async ({ planId }) => {
      const promos = getPromotions();

      return {
        content: [
          {
            type: "text",
            text: "Here are the current Cricket Wireless deals and promotions."
          }
        ],
        structuredContent: {
          view: "promotions",
          planId: planId ?? null,
          promotions: promos
        }
      };
    }
  );

  return server;
}

// ---------------------------------------------------------------------------
// Streamable HTTP wiring with proper sessions
// ---------------------------------------------------------------------------
const transports: Record<string, StreamableHTTPServerTransport> = {};

async function main() {
  const app = express();

  app.use(
    cors({
      origin: "*",
      exposedHeaders: ["Mcp-Session-Id"],
      allowedHeaders: ["Content-Type", "mcp-session-id"]
    })
  );

  // IMPORTANT: JSON for POST bodies
  app.use(express.json({ limit: "2mb" }));

  // Health check
  app.get("/", (_req, res) => res.send("Cricket MCP server is running"));

  // Serve static assets (your built widget is at /public/widget/*)
  app.use("/public", express.static("public"));

  // POST /mcp — client → server JSON-RPC
  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Existing session
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New session: initialize a transport and connect a new server instance
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
          console.log(`MCP session initialized: ${sid}`);
        }
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`MCP session closed: ${sid}`);
          delete transports[sid];
        }
      };

      const server = createCricketServer();
      await server.connect(transport);
    } else {
      return res.status(400).json({
        error: { message: "Bad Request: No valid session ID provided" }
      });
    }

    await transport.handleRequest(req, res, req.body);
  });

  // GET /mcp — server → client stream (SSE)
  // DELETE /mcp — close session
  const handleSessionRequest = async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      return res.status(404).send("Session not found");
    }
    await transports[sessionId].handleRequest(req, res);
  };

  app.use("/public", express.static(path.join(process.cwd(), "public")));
  app.get("/mcp", handleSessionRequest);
  app.get("/debug/widget-uri", (_req, res) => {
  res.json({
    inlineUri: "ui://widget/cricket-plans-inline.html",
    baseUrl: BASE_URL || null
  });
});
  app.delete("/mcp", handleSessionRequest);

  const port = Number(process.env.PORT ?? 8000);

  console.log("BASE_URL =", BASE_URL || "(not set)");
  app.listen(port, () => {
    console.log(`Cricket MCP server listening at http://localhost:${port}/mcp`);
    console.log(`Widget local test: http://localhost:${port}/public/widget/index.html`);
  });
}

main().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
