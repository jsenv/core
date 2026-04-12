import { startDevServer } from "@jsenv/core";
import { serverPluginDatabaseManager } from "@jsenv/database-manager";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("./"),
  port: 8976,
  plugins: [jsenvPluginPreact()],
  serverPlugins: [serverPluginDatabaseManager({ redirectToSource: true })],
});
