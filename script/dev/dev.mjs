import { requestCertificateForLocalhost } from "@jsenv/https-local"

import { startDevServer } from "@jsenv/core"
// import { require } from "@jsenv/core/src/internal/require.js"
import { projectDirectoryUrl } from "../../jsenv.config.mjs"

const { serverCertificate, serverCertificatePrivateKey } =
  await requestCertificateForLocalhost()

startDevServer({
  projectDirectoryUrl,
  // babelPluginMap: {},
  protocol: "https",
  http2: false,
  certificate: serverCertificate,
  privateKey: serverCertificatePrivateKey,
  jsenvDirectoryClean: true,
  // babelPluginMap: {
  //   "transform-react-jsx": [require("@babel/plugin-transform-react-jsx")],
  // },
  // importMapInWebWorkers: true,
  // livereloadLogLevel: "debug",
  // jsenvToolbar: false,
  port: 3456,
  explorableConfig: {
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
})
