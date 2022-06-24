import { requestCertificateForLocalhost } from "@jsenv/https-local"

import { startDevServer } from "@jsenv/core"

const { certificate, privateKey } = requestCertificateForLocalhost({
  altNames: ["local"],
})
await startDevServer({
  port: 3589,
  protocol: "https",
  listenAnyIp: true,
  certificate,
  privateKey,
  rootDirectoryUrl: new URL("./", import.meta.url),
  plugins: [
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
  devServerMainFile: import.meta.url,
})
