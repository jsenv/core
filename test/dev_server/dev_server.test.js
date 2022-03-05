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
})

// const { fetchUrl } = await import("@jsenv/core/src/internal/fetching.js")
// const response = await fetchUrl(`${server.origin}/main.js`)
// const text = await response.text()
// console.log(text)
