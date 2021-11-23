import { requestCertificateForLocalhost } from "@jsenv/https-local"

import { startDevServer } from "@jsenv/core"

import { projectDirectoryUrl } from "../../jsenv.config.mjs"

const { serverCertificate, serverCertificatePrivateKey } =
  await requestCertificateForLocalhost()

startDevServer({
  projectDirectoryUrl,
  babelPluginMap: {},
  protocol: "https",
  http2: true,
  certificate: serverCertificate,
  privateKey: serverCertificatePrivateKey,
  port: 3456,
  explorableConfig: {
    source: {
      "./index.html": false,
      "./src/**/*.html": false,
      "./**/docs/**/*.html": false,
      "./**/.jsenv/": false,
      "./**/node_modules/": false,
    },
    test: {
      "./test/**/*.html": false,
      "./**/docs/**/*.html": false,
      "./test-manual/**/*.html": true,
      "./**/.jsenv/": false,
      "./**/node_modules/": false,
    },
  },
})
