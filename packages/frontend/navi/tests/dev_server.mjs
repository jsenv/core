import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

export const devServer = await startDevServer({
  serverLogLevel: "warn",
  serverRouterLogLevel: "warn",
  sourceDirectoryUrl: import.meta.resolve("../"),
  hostname: "127.0.0.1",
  http2: false,
  port: 0,
  // supervisor: { logs: true },
  plugins: [
    jsenvPluginPreact({
      refreshInstrumentation: true,
    }),
  ],
});
