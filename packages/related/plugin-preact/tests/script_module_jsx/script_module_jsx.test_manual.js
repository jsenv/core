import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  port: 3457,
  ribbon: false,
  plugins: [
    jsenvPluginPreact({
      refreshInstrumentation: true,
    }),
  ],
});
