import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { jsenvPluginToolbar } from "@jsenv/plugin-toolbar";

await startDevServer({
  sourcemaps: "none",
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  outDirectoryUrl: import.meta.resolve("./.jsenv/"),
  keepProcessAlive: true,
  port: 8888,
  plugins: [jsenvPluginToolbar({ logLevel: "debug" }), jsenvPluginPreact()],
  // ribbon: false,
  // clientAutoreload: false,
});
