import { requestCertificateForLocalhost } from "@jsenv/https-local"

import { startExploring } from "@jsenv/core"

import { projectDirectoryUrl } from "../../jsenv.config.mjs"

const { serverCertificate, serverCertificatePrivateKey } =
  await requestCertificateForLocalhost()

startExploring({
  projectDirectoryUrl,
  babelPluginMap: {},
  compileServerProtocol: "https",
  compileServerHttp2: true,
  compileServerCertificate: serverCertificate,
  compileServerPrivateKey: serverCertificatePrivateKey,
  compileServerPort: 3456,
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
