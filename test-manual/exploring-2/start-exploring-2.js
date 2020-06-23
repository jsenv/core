import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { startCompileServer } from "../../src/internal/compiling/startCompileServer.js"
import { jsenvCoreDirectoryUrl } from "../../src/internal/jsenvCoreDirectoryUrl.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`

startCompileServer({
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  compileServerProtocol: "http",
  compileServerPort: 3456,
  keepProcessAlive: true,
})
