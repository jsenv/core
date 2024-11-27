import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

await startDevServer({
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  port: 3457,
  ribbon: false,
  plugins: [
    jsenvPluginPreact({
      refreshInstrumentation: true,
    }),
  ],
});
