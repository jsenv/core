import { assert } from "@jsenv/assert"
import { createLogger } from "@jsenv/logger"
import { createCancellationToken } from "@jsenv/cancellation"
import { resolveDirectoryUrl, urlToRelativeUrl, fileUrlToPath } from "internal/urlUtils.js"
import { readFileContent } from "internal/filesystemUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { jsenvBabelPluginMap } from "src/jsenvBabelPluginMap.js"
import { serveBundle } from "src/serveBundle.js"

const projectDirectoryUrl = jsenvCoreDirectoryUrl
const compileDirectoryUrl = resolveDirectoryUrl("./.dist/", import.meta.url)
const originalFileUrl = import.meta.resolve("./file.js")
const compiledFileUrl = import.meta.resolve("./.dist/.jsenv/file.js")
const compileDirectoryRelativeUrl = urlToRelativeUrl(compileDirectoryUrl, jsenvCoreDirectoryUrl)
const babelPluginMap = jsenvBabelPluginMap

const compileServer = await startCompileServer({
  projectDirectoryUrl,
  compileServerLogLevel: "warn",
  compileDirectoryUrl,
  compileDirectoryClean: true,
  babelPluginMap,
})

const { status: actual } = await serveBundle({
  cancellationToken: createCancellationToken(),
  logger: createLogger({ logLevel: "warn" }),

  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  compileDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,

  format: "commonjs",
  projectFileRequestedCallback: () => {},
  request: {
    origin: compileServer.origin,
    ressource: `/${compileDirectoryRelativeUrl}.dist/.jsenv/file.js`,
    method: "GET",
    headers: {},
  },
  compileServerOrigin: compileServer.origin,
  compileServerImportMap: compileServer.importMap,
  babelPluginMap,
})
const expected = 200
assert({ actual, expected })

{
  const actual = JSON.parse(
    await readFileContent(fileUrlToPath(import.meta.resolve("./.dist/.jsenv/file.js.map"))),
  )
  const expected = {
    version: 3,
    file: "file.js",
    sources: ["../../file.js"],
    sourcesContent: ["export default 42\n"],
    names: [],
    mappings: ";;AAAA,WAAe,EAAf;;;;",
  }
  assert({ actual, expected })
}

{
  const actual = JSON.parse(
    await readFileContent(
      fileUrlToPath(import.meta.resolve("./.dist/.jsenv/file.js__asset__/meta.json")),
    ),
  )
  const expected = {
    contentType: "application/javascript",
    sources: ["../../../file.js"],
    sourcesEtag: ['"12-nhgTHzyRNTJVRX7W7gbGol0Jhbk"'],
    assets: ["../file.js.map"],
    assetsEtag: ['"b9-sDXH5CFs97JCj4eAxzkzxGPlswo"'],
    createdMs: actual.createdMs,
    lastModifiedMs: actual.lastModifiedMs,
  }
  assert({ actual, expected })
}

{
  const actual = import.meta.require("./.dist/.jsenv/file.js")
  const expected = 42
  assert({ actual, expected })
}
