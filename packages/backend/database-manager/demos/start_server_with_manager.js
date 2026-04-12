import { serverPluginDatabaseManager } from "@jsenv/database-manager";
import { fetchFileSystem, startServer } from "@jsenv/server";

await startServer({
  port: 8976,
  plugins: [serverPluginDatabaseManager()],
  routes: [
    {
      endpoint: "GET /",
      fetch: fetchFileSystem(import.meta.resolve("./")),
    },
  ],
});
