import {
  urlToRelativeUrl,
  resolveUrl,
  ensureEmptyDirectory,
} from "@jsenv/filesystem"
import { requestCertificateForLocalhost } from "@jsenv/https-local"

import { startDevServer } from "@jsenv/core"

const { serverCertificate, serverCertificatePrivateKey } =
  await requestCertificateForLocalhost()

const projectDirectoryUrl = new URL("../../../", import.meta.url)
const directoryRelativeUrl = urlToRelativeUrl(
  new URL("./", import.meta.url),
  projectDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${directoryRelativeUrl}.jsenv/`
const jsenvDirectoryUrl = resolveUrl(
  jsenvDirectoryRelativeUrl,
  projectDirectoryUrl,
)
await ensureEmptyDirectory(jsenvDirectoryUrl)

await startDevServer({
  jsenvDirectoryClean: true,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  logLevel: "info",
  protocol: "https",
  http2: true,
  certificate: serverCertificate,
  privateKey: serverCertificatePrivateKey,
  port: 6789,
  sendServerTiming: true,
  jsenvToolbar: false,
})
