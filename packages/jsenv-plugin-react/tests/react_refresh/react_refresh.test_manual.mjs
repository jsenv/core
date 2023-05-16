import { requestCertificate } from "@jsenv/https-local";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";
import { startDevServer } from "@jsenv/core";

import { jsenvPluginReact } from "@jsenv/plugin-react";

const { certificate, privateKey } = requestCertificate({ altNames: ["local"] });
await startDevServer({
  port: 3589,
  https: { certificate, privateKey },
  acceptAnyIp: true,
  rootDirectoryUrl: new URL("./client/", import.meta.url),
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
  clientFiles: {
    "./**": true,
  },
});
