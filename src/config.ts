import { config } from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// Load environment variables from .env file
config();

interface ServerConfig {
  tavilyApiKey: string;
  port: number;
  configSources: {
    tavilyApiKey: "cli" | "env";
    port: "cli" | "env" | "default";
  };
}

interface CliArgs {
  "tavily-api-key"?: string;
  port?: number;
}

function maskApiKey(key: string): string {
  return key.length <= 4 ? "****" : `****${key.slice(-4)}`;
}

export function getServerConfig(isStdioMode = false): ServerConfig {
  const argv = yargs(hideBin(process.argv))
    .options({
      "tavily-api-key": {
        type: "string",
        description: "Tavily API key",
      },
      port: {
        type: "number",
        description: "Port to run the server on",
      },
    })
    .help()
    .version("0.1.0")
    .parseSync() as CliArgs;

  const config: ServerConfig = {
    tavilyApiKey: "",
    port: 3333,
    configSources: {
      tavilyApiKey: "env",
      port: "default",
    },
  };

  // Resolve API Key
  if (argv["tavily-api-key"]) {
    config.tavilyApiKey = argv["tavily-api-key"];
    config.configSources.tavilyApiKey = "cli";
  } else if (process.env.TAVILY_API_KEY) {
    config.tavilyApiKey = process.env.TAVILY_API_KEY;
    config.configSources.tavilyApiKey = "env";
  }

  if (!config.tavilyApiKey) {
    console.error(
      "TAVILY_API_KEY is required via --tavily-api-key or environment variable."
    );
    process.exit(1);
  }

  // Resolve Port
  if (argv.port) {
    config.port = argv.port;
    config.configSources.port = "cli";
  } else if (process.env.PORT) {
    config.port = parseInt(process.env.PORT, 10);
    config.configSources.port = "env";
  }

  if (!isStdioMode) {
    console.log("\nConfiguration:");
    console.log(
      `- TAVILY_API_KEY: ${maskApiKey(config.tavilyApiKey)} (source: ${
        config.configSources.tavilyApiKey
      })`
    );
    console.log(
      `- PORT: ${config.port} (source: ${config.configSources.port})`
    );
    console.log();
  }

  return config;
}
