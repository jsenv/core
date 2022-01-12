import { requestCertificateForLocalhost } from "@jsenv/https-local"

import { startDevServer } from "@jsenv/core"
import { projectDirectoryUrl } from "../../jsenv.config.mjs"

const { serverCertificate, serverCertificatePrivateKey } =
  await requestCertificateForLocalhost()

startDevServer({
  projectDirectoryUrl,
  // babelPluginMap: {},
  protocol: "https",
  http2: true,
  certificate: serverCertificate,
  privateKey: serverCertificatePrivateKey,
  jsenvDirectoryClean: true,
  importMapInWebWorkers: true,
  // livereloadLogLevel: "debug",
  // jsenvToolbar: false,
  port: 3456,
  workers: ["./test/workers/worker_importmap/worker.js"],
  serviceWorkers: ["./test/workers/service_worker_importmap/service_worker.js"],
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
      "./test/workers/**/*.html": true,
      "./test/entry_html/**/*.html": true,
      "./test/external_url/**/*.html": true,
      "./**/.jsenv/": false,
      "./**/dist/": false,
      "./**/node_modules/": false,
    },
  },
})
