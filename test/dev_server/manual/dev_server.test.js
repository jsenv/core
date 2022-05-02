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
  // autoreload: false,
  // sourcemaps: "file",
  plugins: [
    jsenvPluginPreact(),
    {
      name: "plugin_throwing",
      appliesDuring: "*",
      resolveUrl: ({ parentUrl, specifier }) => {
        if (
          parentUrl.includes("plugin_error_resolve/main.js") &&
          specifier === "./file.js"
        ) {
          throw new Error("here")
        }
      },
      fetchUrlContent: ({ url }) => {
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
