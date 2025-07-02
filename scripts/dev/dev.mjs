import { startDevServer } from "@jsenv/core";
// import { requestCertificate } from "@jsenv/https-local";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";
import { jsenvPluginDatabaseManager } from "@jsenv/plugin-database-manager";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

const jsenvPluginControlledResource = () => {
  let resolve;
  return {
    devServerRoutes: [
      {
        endpoint: "GET /__delayed__.js",
        fetch: async () => {
          if (resolve) {
            resolve();
          }
          const promise = new Promise((r) => {
            resolve = r;
          });
          await promise;
          return {
            status: 200,
            body: "",
            headers: {
              "content-length": 0,
            },
          };
        },
      },
      {
        endpoint: "POST /__delayed__.js",
        fetch: async () => {
          if (resolve) {
            resolve();
          }
          return {
            status: 200,
          };
        },
      },
    ],
  };
};

// const { certificate, privateKey } = requestCertificate();
await startDevServer({
  serverLogLevel: "warn",
  sourceDirectoryUrl: import.meta.resolve("../../"),
  hostname: "127.0.0.1",
  // https: { certificate, privateKey },
  http2: false,
  port: 3456,
  // supervisor: { logs: true },
  plugins: [
    jsenvPluginControlledResource(),
    jsenvPluginPreact({
      refreshInstrumentation: true,
    }),
    jsenvPluginExplorer({
      groups: {
        errors: {
          "./tests/dev_server/errors/stories/**/*.html": true,
        },
        router: {
          "./packages/tooling/**/router/**/*.html": true,
        },
        tests: {
          "./tests/**/client/main.html": true,
        },
      },
    }),
    jsenvPluginDatabaseManager(),
    jsenvPluginCommonJs({
      include: { "react-table/": true },
    }),
  ],
});
