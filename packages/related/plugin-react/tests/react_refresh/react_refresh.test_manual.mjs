import { startDevServer } from "@jsenv/core";
import { requestCertificate } from "@jsenv/https-local";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";

import { jsenvPluginReact } from "@jsenv/plugin-react";

const { certificate, privateKey } = requestCertificate({ altNames: ["local"] });
await startDevServer({
  port: 3589,
  https: { certificate, privateKey },
  acceptAnyIp: true,
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  plugins: [
    jsenvPluginExplorer({
      groups: {
        main: {
          "./main.html": true,
        },
      },
    }),
    jsenvPluginReact({ refreshInstrumentation: true }),
  ],
});
