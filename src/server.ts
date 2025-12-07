// src/server.ts

import express, { Request, Response } from "express";
import cors from "cors";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import {
  PLANS,
  CricketPlanId,
  checkCoverage,
  checkDeviceCompatibility,
  getPromotions
} from "./cricketData.js";

/**
 * Create a fresh MCP server instance and register all Cricket tools.
 * This is called once per HTTP request (stateless pattern).
 */
function createCricketServer() {
  const server = new McpServer({
    name: "cricket-sales-app",
    version: "0.1.0"
  });

  // ---- Tools ----

  // Show plans
  server.tool(
    "cricket_view_plans",
    "Show Cricket Wireless plans for this user.",
    {
      recommendedPlanId: z
        .enum(["10gb", "unlimited_core", "unlimited_more"])
        .optional()
    },
    async ({ recommendedPlanId }) => {
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

  // Check coverage by ZIP
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

  // Check device compatibility by IMEI
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

  // List promotions
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

/**
 * Handle a single MCP HTTP request in **stateless** mode:
 * - create a fresh server + transport
 * - connect
 * - handle the request
 * - clean up on close
 */
async function handleMCPRequest(req: Request, res: Response) {
  try {
    const server = createCricketServer();

    // Stateless mode: no sessionIdGenerator
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    // Cleanup when response finishes
    res.on("close", () => {
      transport.close();
      if (typeof (server as any).close === "function") {
        (server as any).close();
      }
    });
  } catch (error) {
    console.error("Unhandled MCP error", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal MCP server error"
        },
        id: (req.body as any)?.id ?? null
      });
    }
  }
}

async function main() {
  const app = express();

  // CORS – a bit more explicit, in case a browser-based client is involved
  app.use(
    cors({
      origin: "*",
      exposedHeaders: ["Mcp-Session-Id"],
      allowedHeaders: ["Content-Type", "mcp-session-id"]
    })
  );

  app.use(express.json());

  // Simple health check for sanity
  app.get("/", (_req, res) => {
    res.send("Cricket MCP server is running");
  });

  // Serve your UI widget
  app.use("/public", express.static("public"));

  // MCP endpoint – stateless, same handler for POST/GET/DELETE
  app.post("/mcp", handleMCPRequest);
  app.get("/mcp", handleMCPRequest);
  app.delete("/mcp", handleMCPRequest);

  const port = Number(process.env.PORT ?? 8000);
  app.listen(port, () => {
    console.log(`Cricket MCP server listening at http://localhost:${port}/mcp`);
  });
}

main().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
