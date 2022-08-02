import { requestCertificate } from "@jsenv/https-local"

import { startDevServer } from "@jsenv/core"
import { jsenvPluginReact } from "@jsenv/plugin-react"

const { certificate, privateKey } = requestCertificate({ altNames: ["local"] })
await startDevServer({
  port: 3589,
  protocol: "https",
  acceptAnyIp: true,
  certificate,
  privateKey,
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  plugins: [jsenvPluginReact()],
  explorer: {
    groups: {
      main: {
        "./main.html": true,
      },
    },
  },
  clientFiles: {
    "./**": true,
  },
})
