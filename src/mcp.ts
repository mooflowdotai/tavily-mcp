import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import axios from "axios";
import yaml from "js-yaml";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { Logger } from "./logger.js";

interface TavilyResponse {
  query: string;
  follow_up_questions?: Array<string>;
  answer?: string;
  images?: Array<string | { url: string; description?: string }>;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    published_date?: string;
    raw_content?: string;
  }>;
}

export class CustomMcpServer extends McpServer {
  constructor(apiKey: string) {
    super(
      { name: "Tavily MCP Server", version: "0.1.0" },
      { capabilities: { logging: {}, tools: {} } }
    );

    if (!apiKey) throw new Error("TAVILY_API_KEY is required");

    this.registerTools(apiKey);
  }

  private registerTools(apiKey: string): void {
    this.tool(
      "tavily_search",
      "A powerful web search tool that provides comprehensive, real-time results using Tavily's AI search engine.",
      {
        query: z.string().describe("Search query"),
        search_depth: z
          .enum(["basic", "advanced"])
          .optional()
          .default("basic")
          .describe("The depth of the search. It can be 'basic' or 'advanced'"),
        topic: z
          .enum(["general", "news"])
          .optional()
          .default("general")
          .describe(
            "The category of the search. Determines which agent is used"
          ),
        days: z
          .number()
          .optional()
          .default(3)
          .describe(
            "Number of days back from today to include in search results. Only applies to 'news' topic."
          ),
        time_range: z
          .enum(["day", "week", "month", "year", "d", "w", "m", "y"])
          .nullable()
          .optional()
          .describe(
            "The relative time range to search within (e.g., 'day', 'month', etc.)"
          ),
        max_results: z
          .number()
          .min(5)
          .max(20)
          .optional()
          .default(10)
          .describe("Maximum number of search results to return"),
        include_images: z
          .boolean()
          .optional()
          .default(false)
          .describe("Whether to include a list of images in the response"),
        include_image_descriptions: z
          .boolean()
          .optional()
          .default(false)
          .describe("Whether to include image descriptions"),
        include_raw_content: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "Whether to include cleaned, parsed HTML content of results"
          ),
        include_domains: z
          .array(z.string())
          .optional()
          .default([])
          .describe("List of domains to include (e.g. ['nytimes.com'])"),
        exclude_domains: z
          .array(z.string())
          .optional()
          .default([])
          .describe("List of domains to exclude"),
      },
      async (args) => {
        try {
          Logger.log("Calling Tavily Search API with:", args.query);

          const payload = {
            ...args,
            topic:
              args.topic ||
              (args.query.toLowerCase().includes("news") ? "news" : "general"),
            api_key: apiKey,
          };

          const res = await axios.post(
            "https://api.tavily.com/search",
            payload,
            {
              headers: {
                "x-api-key": apiKey,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            }
          );

          const result: TavilyResponse = res.data;
          const yamlResult = yaml.dump(result);

          return { content: [{ type: "text", text: yamlResult }] };
        } catch (error) {
          const message = axios.isAxiosError(error)
            ? error.response?.data?.message || error.message
            : String(error);
          Logger.error("Tavily search failed:", message);
          return {
            isError: true,
            content: [
              { type: "text", text: `Tavily search failed: ${message}` },
            ],
          };
        }
      }
    );

    this.tool(
      "tavily_extract",
      "Extract detailed content from specific URLs using Tavily's extractor.",
      {
        urls: z
          .array(z.string())
          .describe("List of URLs to extract content from"),
        extract_depth: z
          .enum(["basic", "advanced"])
          .optional()
          .default("basic")
          .describe(
            "Extraction depth – use 'advanced' for rich structured content (e.g., LinkedIn)"
          ),
        include_images: z
          .boolean()
          .optional()
          .default(false)
          .describe("Include images extracted from the pages"),
      },
      async ({ urls, extract_depth, include_images }) => {
        try {
          Logger.log("Calling Tavily Extract API with:", urls);

          const res = await axios.post(
            "https://api.tavily.com/extract",
            {
              urls,
              extract_depth,
              include_images,
              api_key: apiKey,
            },
            {
              headers: {
                "x-api-key": apiKey,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            }
          );

          const result: TavilyResponse = res.data;
          const yamlResult = yaml.dump(result);

          return { content: [{ type: "text", text: yamlResult }] };
        } catch (error) {
          const message = axios.isAxiosError(error)
            ? error.response?.data?.message || error.message
            : String(error);
          Logger.error("Tavily extract failed:", message);
          return {
            isError: true,
            content: [
              { type: "text", text: `Tavily extract failed: ${message}` },
            ],
          };
        }
      }
    );
  }

  async connect(transport: Transport): Promise<void> {
    await super.connect(transport);

    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: any, encoding?: any, callback?: any) => {
      if (typeof chunk === "string" && !chunk.trim().startsWith("{")) {
        return true; // suppress non-JSON stdout
      }
      return originalStdoutWrite(chunk, encoding, callback);
    };

    Logger.log("Tavily MCP server is running.");
  }
}
