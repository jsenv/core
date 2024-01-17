import { startDevServer } from "@jsenv/core";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";

export const devServer = await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  port: 3459,
  clientAutoreload: false,
  plugins: [jsenvPluginExplorer()],
});
