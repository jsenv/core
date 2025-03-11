import { startDevServer } from "@jsenv/core";
import { jsenvPluginToolbar } from "@jsenv/plugin-toolbar";

startDevServer({
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  plugins: [
    jsenvPluginToolbar({
      logLevel: "debug",
    }),
  ],
});
