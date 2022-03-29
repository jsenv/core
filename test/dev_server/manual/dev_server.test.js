import { requestCertificateForLocalhost } from "@jsenv/https-local"

import { startDevServer } from "@jsenv/core/src/dev/start_dev_server.js"
import { jsenvPluginPreact } from "@jsenv/core/packages/jsenv-plugin-preact/index.js"

const { serverCertificate, serverCertificatePrivateKey } =
  await requestCertificateForLocalhost({
    serverCertificateAltNames: ["local"],
  })
await startDevServer({
  port: 3589,
  protocol: "https",
  certificate: serverCertificate,
  privateKey: serverCertificatePrivateKey,
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  // autoreload: false,
  // sourcemaps: "file",
  plugins: [
    jsenvPluginPreact(),
    {
      name: "plugin_throwing",
      appliesDuring: "*",
      resolve: ({ parentUrl, specifier }) => {
        if (
          parentUrl.includes("plugin_error_resolve/main.js") &&
          specifier === "./file.js"
        ) {
          throw new Error("here")
        }
      },
      load: ({ url }) => {
        if (url.includes("plugin_error_load/main.js")) {
          throw new Error("here")
        }
      },
    },
  ],
  explorerGroups: {
    main: {
      "./main/**/*.html": true,
    },
    autoreload: {
      "./autoreload/**/*.html": true,
    },
    errors: {
      "./errors/**/*.html": true,
    },
  },
  // toolbar: false,
})

// const { fetchUrl } = await import("@jsenv/core/src/internal/fetching.js")
// const response = await fetchUrl(`${server.origin}/main.js`)
// const text = await response.text()
// console.log(text)
