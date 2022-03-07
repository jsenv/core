import { requestCertificateForLocalhost } from "@jsenv/https-local"
import { startDevServer } from "@jsenv/core/src/dev/start_dev_server.js"
// import { jsenvPluginPreact } from "@jsenv/core/packages/jsenv-plugin-preact/index.js"

const { serverCertificate, serverCertificatePrivateKey } =
  await requestCertificateForLocalhost({
    serverCertificateAltNames: ["local"],
  })
await startDevServer({
  port: 3589,
  protocol: "https",
  certificate: serverCertificate,
  privateKey: serverCertificatePrivateKey,
  projectDirectoryUrl: new URL("./client/", import.meta.url),
  // plugins: [jsenvPluginPreact()],
  plugins: [
    {
      name: "plugin_throw_during_load",
      appliesDuring: "*",
      load: ({ url }) => {
        if (url.includes("plugin_error_load/main.js")) {
          throw new Error("here")
        }
      },
    },
  ],
})

// const { fetchUrl } = await import("@jsenv/core/src/internal/fetching.js")
// const response = await fetchUrl(`${server.origin}/main.js`)
// const text = await response.text()
// console.log(text)
