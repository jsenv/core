import { requestCertificate } from "@jsenv/https-local";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";

import { startDevServer } from "@jsenv/core";

const { certificate, privateKey } = requestCertificate();
await startDevServer({
  sourceDirectoryUrl: new URL("../../", import.meta.url),
  https: { certificate, privateKey },
  http2: false,
  port: 3456,
  supervisor: {
    logs: true,
  },
  plugins: [
    jsenvPluginExplorer({
      groups: {
        main: {
          "./dev_exploring/main/**/*.html": true,
        },
        autoreload: {
          "./dev_exploring/autoreload/**/*.html": true,
        },
        errors: {
          "./dev_exploring/errors/**/*.html": true,
        },
        other: {
          "./dev_exploring/other/**/*.html": true,
        },
        tests: {
          "./tests/**/client/main.html": true,
        },
      },
    }),
  ],
});
