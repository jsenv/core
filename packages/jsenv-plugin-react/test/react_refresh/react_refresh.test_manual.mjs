import { requestCertificateForLocalhost } from "@jsenv/https-local"

import { startDevServer } from "@jsenv/core"
import { jsenvPluginReact } from "@jsenv/plugin-react"

const { serverCertificate, serverCertificatePrivateKey } =
  await requestCertificateForLocalhost({
    serverCertificateAltNames: ["local"],
  })
await startDevServer({
  port: 3589,
  protocol: "https",
  listenAnyIp: true,
  certificate: serverCertificate,
  privateKey: serverCertificatePrivateKey,
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  plugins: [jsenvPluginReact()],
  explorerGroups: {
    main: {
      "./main.html": true,
    },
  },
  autorestart: {
    file: import.meta.url,
  },
})
