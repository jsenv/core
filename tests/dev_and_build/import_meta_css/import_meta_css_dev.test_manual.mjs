import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  plugins: [jsenvPluginPreact()],
});
