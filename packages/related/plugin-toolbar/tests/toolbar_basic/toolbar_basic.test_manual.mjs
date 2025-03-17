import { startDevServer } from "@jsenv/core";
import { jsenvPluginToolbar } from "@jsenv/plugin-toolbar";

startDevServer({
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  plugins: [
    jsenvPluginToolbar({
      logLevel: "debug",
    }),
  ],
});
