import { startDevServer } from "@jsenv/core";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";

export const devServer = await startDevServer({
  hostname: "127.0.0.1",
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  port: 3459,
  clientAutoreload: false,
  plugins: [jsenvPluginExplorer()],
});
