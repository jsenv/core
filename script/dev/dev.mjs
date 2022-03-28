import { requestCertificateForLocalhost } from "@jsenv/https-local"

import { startDevServer } from "@jsenv/core"

import { rootDirectoryUrl } from "../../jsenv.config.mjs"

const { serverCertificate, serverCertificatePrivateKey } =
  await requestCertificateForLocalhost({
    serverCertificateAltNames: ["local"],
  })

await startDevServer({
  rootDirectoryUrl,
  // babelPluginMap: {},
  protocol: "https",
  http2: false,
  certificate: serverCertificate,
  privateKey: serverCertificatePrivateKey,
  // importMapInWebWorkers: true,
  // livereloadLogLevel: "debug",
  // jsenvToolbar: false,
  port: 3456,
  explorer: {
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
    },
  },
})
