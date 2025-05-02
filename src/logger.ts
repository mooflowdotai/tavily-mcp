// Re-export the server and its types
export { getServerConfig } from "./config.js";

export const Logger = {
  log: (...args: any[]) => {
    console.error("[INFO]", ...args);
  },
  error: (...args: any[]) => {
    console.error("[ERROR]", ...args);
  },
};
