import { startDevServer } from "@jsenv/core";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";

await startDevServer({
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  plugins: [jsenvPluginExplorer()],
  clientAutoreload: false,
});
