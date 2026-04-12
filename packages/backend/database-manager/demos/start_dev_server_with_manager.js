import { startDevServer } from "@jsenv/core";
import { serverPluginDatabaseManager } from "@jsenv/database-manager";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("./"),
  port: 8976,
  serverPlugins: [serverPluginDatabaseManager()],
});
