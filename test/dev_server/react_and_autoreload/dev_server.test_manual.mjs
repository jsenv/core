import { requestCertificateForLocalhost } from "@jsenv/https-local"

import { startDevServer } from "@jsenv/core"
import { jsenvPluginReact } from "@jsenv/core/packages/jsenv-plugin-react/main.js"

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
  plugins: [jsenvPluginReact()],
  explorerGroups: {
    main: {
      "./client/main.html": true,
    },
  },
  // toolbar: false,
  autorestart: {
    url: import.meta.url,
  },
})

// const { fetchUrl } = await import("@jsenv/core/src/internal/fetching.js")
// const response = await fetchUrl(`${server.origin}/main.js`)
// const text = await response.text()
// console.log(text)
