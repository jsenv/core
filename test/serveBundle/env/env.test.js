import { assert } from "@jsenv/assert"
import { createLogger } from "@jsenv/logger"
import { createCancellationToken } from "@jsenv/cancellation"
import { COMPILE_DIRECTORY } from "internal/CONSTANTS.js"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  fileUrlToPath,
  resolveFileUrl,
} from "internal/urlUtils.js"
import { readFileContent } from "internal/filesystemUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { serveBundle } from "internal/compiling/serveBundle.js"
import { jsenvBabelPluginMap } from "src/jsenvBabelPluginMap.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const projectDirectoryUrl = jsenvCoreDirectoryUrl
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const compileDirectoryRelativeUrl = `${jsenvDirectoryRelativeUrl}${COMPILE_DIRECTORY}/`
const originalFileUrl = import.meta.resolve("./file.js")
const compiledFileUrl = import.meta.resolve(`./.jsenv/file.js`)
const babelPluginMap = jsenvBabelPluginMap

const compileServer = await startCompileServer({
  compileServerLogLevel: "debug",
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean: true,
  babelPluginMap,
  env: {
    whatever: 42,
  },
})

const { status: actual } = await serveBundle({
  cancellationToken: createCancellationToken(),
  logger: createLogger({ logLevel: "debug" }),

  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  compileDirectoryUrl: resolveDirectoryUrl(compileDirectoryRelativeUrl, jsenvCoreDirectoryUrl),
  originalFileUrl,
  compiledFileUrl,

  format: "commonjs",
  projectFileRequestedCallback: () => {},
  request: {
    origin: compileServer.origin,
    ressource: `/${compileDirectoryRelativeUrl}.jsenv/${COMPILE_DIRECTORY}/file.js`,
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
  const sourcemapFileUrl = `${compiledFileUrl}.map`
  const actual = JSON.parse(await readFileContent(fileUrlToPath(sourcemapFileUrl)))
  const expected = {
    version: 3,
    file: "file.js",
    sources: ["env.js", "../file.js"],
    sourcesContent: [
      await readFileContent(fileUrlToPath(resolveFileUrl("env.js", sourcemapFileUrl))),
      await readFileContent(fileUrlToPath(resolveFileUrl("../file.js", sourcemapFileUrl))),
    ],
    names: actual.names,
    mappings: actual.mappings,
  }
  assert({ actual, expected })
}

{
  const actual = JSON.parse(
    await readFileContent(fileUrlToPath(`${compiledFileUrl}__asset__/meta.json`)),
  )
  const expected = {
    contentType: "application/javascript",
    sources: ["../env.js", "../../file.js"],
    sourcesEtag: ['"96-/kZNIWrfacWLsajUBBbUUefYqhk"', '"74-JkgWQFIQU27HSNNc1YgGudblXWE"'],
    assets: ["../file.js.map"],
    assetsEtag: ['"1f5-dGxXb3qpu4fzWm5yY+7YNSKJQKU"'],
    createdMs: actual.createdMs,
    lastModifiedMs: actual.lastModifiedMs,
  }
  assert({ actual, expected })
}

{
  const actual = import.meta.require(fileUrlToPath(compiledFileUrl))
  const expected = 42
  assert({ actual, expected })
}
