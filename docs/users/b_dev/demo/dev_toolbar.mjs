import { startDevServer } from "@jsenv/core";
import { jsenvPluginToolbar } from "@jsenv/plugin-toolbar";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("./src/"),
  plugins: [jsenvPluginToolbar()],
});
