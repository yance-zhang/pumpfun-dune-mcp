// dune-server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import AbortController from "abort-controller";
import { DuneClient } from "@duneanalytics/client-sdk";

(global as any).AbortController = AbortController;

dotenv.config();

const DUNE_API_KEY = "s9idurdqgmDm1uaYOwkozgtZzA560JXF";
const DUNE_API_URL = "https://api.dune.com/api/v1";

if (!DUNE_API_KEY) {
  throw new Error("DUNE_API_KEY environment variable is required");
}

const fetchOptions = {
  method: "GET",
  headers: { "X-DUNE-API-KEY": DUNE_API_KEY },
};

class DuneDataServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "dune-data-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    this.setupResourceHandlers();
    this.setupToolHandlers();
  }

  private setupResourceHandlers(): void {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "dune://hashed_official/pumpdotfun",
          name: "Pumpfun Dashboard Data",
          mimeType: "application/json",
          description: "Data from the Pumpfun dashboard on Dune",
        },
      ],
    }));
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "get_query_data",
          description: "Get data from a specific query_id",
          inputSchema: {
            type: "object",
            properties: {
              query_id: {
                type: "string",
                description: "Query Id identifier",
              },
            },
            required: ["query_id"],
          },
        },
        {
          name: "get_dashboard_queries",
          description: "get pumpfun Dune dashboard query_ids",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === "get_dashboard_queries") {
        try {
          const queries = [
            {
              query_id: "3705945",
              description: "Total deployed",
            },
            {
              query_id: "3706280",
              description: "Fee & Revenue",
            },
            {
              query_id: "3919233",
              description: "Monthly transactions and monthly volume",
            },
          ];

          const jsonString = JSON.stringify(queries, null, 2);

          return {
            content: [
              {
                type: "text",
                text: jsonString,
              },
            ],
          };
        } catch (error) {
          console.log(error);
        }
      }
      if (request.params.name === "get_query_data") {
        const query_id = (request.params.arguments as any).query_id;
        if (!query_id) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing query_id parameter"
          );
        }

        try {
          const results = await fetch(
            `${DUNE_API_URL}/query/${query_id}/results`,
            fetchOptions
          );

          const dashboardData = await results.json();
          console.error("dashboardData", dashboardData);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(dashboardData, null, 2),
              },
            ],
          };
        } catch (error) {
          console.error("query_id", query_id);
          console.error(error);
          throw error;
        }
      }

      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${request.params.name}`
      );
    });
  }
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error("Dune Data MCP server running on stdio");
  }
}

const server = new DuneDataServer();
server.run().catch(console.error);
