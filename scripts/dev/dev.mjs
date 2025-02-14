import { startDevServer } from "@jsenv/core";
// import { requestCertificate } from "@jsenv/https-local";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import {
  clientControlledResourceService,
  JSONFileManagerService,
} from "@jsenv/router/src/server/server_stuff.js";

// const { certificate, privateKey } = requestCertificate();
await startDevServer({
  sourceDirectoryUrl: new URL("../../", import.meta.url),
  hostname: "127.0.0.1",
  // https: { certificate, privateKey },
  http2: false,
  port: 3456,
  // supervisor: { logs: true },
  services: [clientControlledResourceService(), JSONFileManagerService()],
  plugins: [
    jsenvPluginPreact(),
    jsenvPluginExplorer({
      groups: {
        errors: {
          "./tests/dev_server/errors/stories/**/*.html": true,
        },
        router: {
          "./packages/independent/**/router/**/*.html": true,
        },
        tests: {
          "./tests/**/client/main.html": true,
        },
      },
    }),
  ],
});
