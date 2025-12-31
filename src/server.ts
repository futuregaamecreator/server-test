// src/server.ts

import express, { Request, Response } from "express";
import cors from "cors";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import {
  PLANS,
  CricketPlanId,
  checkCoverage,
  checkDeviceCompatibility,
  getPromotions
} from "./cricketData.js";

/**
 * Create a fresh MCP server instance and register all Cricket tools + widget.
 * This will be created once per MCP session.
 */
function createCricketServer() {
  const server = new McpServer({
    name: "cricket-sales-app",
    version: "0.1.0"
  });

  // 🔹 Load your HTML widget from public/cricket-widget.html
  const widgetHtml = readFileSync(
  join(process.cwd(), "public/widget/index.html"),
  "utf8"
);

  // 🔹 Register the widget as a UI resource for Apps SDK
  server.registerResource(
    "cricket-plans-widget", // internal name
    "ui://widget/cricket-plans.html", // URI referenced by tools
    {},
    async () => ({
      contents: [
        {
          uri: "ui://widget/cricket-plans.html",
          mimeType: "text/html+skybridge", // IMPORTANT for Apps SDK
          text: widgetHtml,
          _meta: {
            "openai/widgetDescription":
              "Helps users pick a Cricket Wireless plan, check coverage, and see deals.",
            "openai/widgetPrefersBorder": true,
              "openai/widgetInitialHeight": "tall", // ⬆️ bigger height
  "openai/widgetInitialWidth": "full"   // ⬅️➡️ full-width widget
          }
        }
      ]
    })
  );

  // ---------------------------------------------------------------------------
  // TOOLS
  // ---------------------------------------------------------------------------

  // ✅ Plans tool, wired to the widget via openai/outputTemplate
  server.registerTool(
    "cricket_view_plans",
    {
      title: "Cricket: view plans",
      description: "Show Cricket Wireless plans and help the user pick one.",
      inputSchema: {
        // Zod shape-style schema
        recommendedPlanId: z
          .enum(["10gb", "unlimited_core", "unlimited_more"])
          .optional()
          .describe("Optional preselected plan to highlight for the user.")
      },
      _meta: {
        // Link this tool's output to your HTML widget
        "openai/outputTemplate": "ui://widget/cricket-plans.html",
        "openai/toolInvocation/invoking": "Loading Cricket Wireless plans…",
        "openai/toolInvocation/invoked": "Cricket plans loaded.",
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

  // ✅ Coverage tool
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
        content: [
          {
            type: "text",
            text: `Coverage in ${zip}: ${result.quality}.`
          }
        ],
        structuredContent: {
          view: "coverage",
          coverage: result
        }
      };
    }
  );

  // ✅ Device compatibility tool
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
        content: [
          {
            type: "text",
            text: result.message
          }
        ],
        structuredContent: {
          view: "device",
          device: result
        }
      };
    }
  );

  // ✅ Promotions tool
  server.tool(
    "cricket_promotions",
    "Show current Cricket promotions, optionally filtered by plan.",
    {
      planId: z
        .enum(["10gb", "unlimited_core", "unlimited_more"])
        .optional()
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
// Streamable HTTP wiring with proper sessions (official pattern)
// ---------------------------------------------------------------------------

// Map sessionId -> transport
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

async function main() {
  const app = express();

  app.use(
    cors({
      origin: "*",
      exposedHeaders: ["Mcp-Session-Id"],
      allowedHeaders: ["Content-Type", "mcp-session-id"]
    })
  );
  app.use(express.json());

  // Simple health check
  app.get("/", (_req, res) => {
    res.send("Cricket MCP server is running");
  });

  // Serve your UI widget assets
  app.use("/public", express.static("public"));

  // POST /mcp — client → server JSON-RPC
  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Existing session: reuse its transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New session: initialize
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
          console.log(`MCP session initialized: ${sid}`);
        }
      });

      // Clean up when session closes
      transport.onclose = () => {
        if (transport.sessionId && transports[transport.sessionId]) {
          console.log(`MCP session closed: ${transport.sessionId}`);
          delete transports[transport.sessionId];
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

  // Shared handler for GET (streaming) and DELETE (session close)
  const handleSessionRequest = async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      return res.status(404).send("Session not found");
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  };

  // GET /mcp — server → client stream (SSE)
  app.get("/mcp", handleSessionRequest);

  // DELETE /mcp — explicit session termination
  app.delete("/mcp", handleSessionRequest);

  const port = Number(process.env.PORT ?? 8000);
  app.listen(port, () => {
    console.log(`Cricket MCP server listening at http://localhost:${port}/mcp`);
  });
}

main().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
