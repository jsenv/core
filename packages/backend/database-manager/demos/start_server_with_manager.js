import { serverPluginDatabaseManager } from "@jsenv/database-manager";
import { startServer } from "@jsenv/server";

await startServer({
  plugins: [serverPluginDatabaseManager()],
});
