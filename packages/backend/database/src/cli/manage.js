import { startDevServer } from "@jsenv/core";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";
import { jsenvPluginDatabaseManager } from "@jsenv/plugin-database-manager";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

// const { certificate, privateKey } = requestCertificate();
await startDevServer({
  serverLogLevel: "warn",
  sourceDirectoryUrl: import.meta.resolve("./"),
  hostname: "127.0.0.1",
  // https: { certificate, privateKey },
  http2: false,
  port: 3456,
  // supervisor: { logs: true },
  plugins: [
    jsenvPluginPreact({
      refreshInstrumentation: true,
    }),
    jsenvPluginDatabaseManager(),
    jsenvPluginCommonJs({
      include: { "/**/node_modules/react-table/": true },
    }),
  ],
});
