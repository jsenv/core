import { requestCertificateForLocalhost } from "@jsenv/https-local"

import { startDevServer } from "@jsenv/core"
import { jsenvPluginPreact } from "@jsenv/core/packages/jsenv-plugin-preact/main.js"

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
  rootDirectoryUrl: new URL("./", import.meta.url),
  plugins: [jsenvPluginPreact()],
  explorerGroups: {
    main: {
      "./client/main.html": true,
    },
  },
  autorestart: {
    url: import.meta.url,
  },
})
