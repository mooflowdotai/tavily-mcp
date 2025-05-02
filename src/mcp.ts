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
      "Use Tavily AI-powered search engine to get real-time, rich web results.",
      {
        query: z.string().describe("Search query"),
        search_depth: z
          .enum(["basic", "advanced"])
          .optional()
          .describe("Search depth"),
        topic: z.enum(["general", "news"]).optional().describe("Search topic"),
        days: z.number().optional().describe("How many days back to search"),
        time_range: z
          .enum(["day", "week", "month", "year", "d", "w", "m", "y"])
          .optional(),
        max_results: z.number().min(5).max(20).optional(),
        include_images: z.boolean().optional(),
        include_image_descriptions: z.boolean().optional(),
        include_raw_content: z.boolean().optional(),
        include_domains: z.array(z.string()).optional(),
        exclude_domains: z.array(z.string()).optional(),
      },
      async ({
        query,
        search_depth,
        topic,
        days,
        time_range,
        max_results,
        include_images,
        include_image_descriptions,
        include_raw_content,
        include_domains,
        exclude_domains,
      }) => {
        try {
          Logger.log("Calling Tavily Search API with:", query);

          const payload = {
            query,
            search_depth,
            topic:
              topic ||
              (query.toLowerCase().includes("news") ? "news" : "general"),
            days,
            time_range,
            max_results,
            include_images,
            include_image_descriptions,
            include_raw_content,
            include_domains,
            exclude_domains,
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
        urls: z.array(z.string()).describe("List of URLs to extract from"),
        extract_depth: z.enum(["basic", "advanced"]).optional(),
        include_images: z.boolean().optional(),
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
