/* eslint-disable import/max-dependencies */
import { readFileSync } from "fs"
import { assert } from "@jsenv/assert"
import { createLogger } from "@jsenv/logger"
import { createCancellationToken } from "@jsenv/cancellation"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToFileSystemPath,
  resolveUrl,
  readFileContent,
} from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { bufferToEtag } from "internal/compiling/compile-directory/bufferToEtag.js"
import { serveBundle } from "internal/compiling/serveBundle.js"
import { jsenvBabelPluginMap } from "src/jsenvBabelPluginMap.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const projectDirectoryUrl = jsenvCoreDirectoryUrl
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const originalFileUrl = import.meta.resolve("./file.js")
const compiledFileUrl = import.meta.resolve(`./.jsenv/file.js`)
const babelPluginMap = jsenvBabelPluginMap

const {
  outDirectoryRelativeUrl,
  origin: compileServerOrigin,
  compileServerImportMap,
} = await startCompileServer({
  compileServerLogLevel: "warn",
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean: true,
  babelPluginMap,
  env: {
    whatever: 42,
  },
})
const ressource = `/${outDirectoryRelativeUrl}file.js`

const { status: actual } = await serveBundle({
  cancellationToken: createCancellationToken(),
  logger: createLogger({
    logLevel: "warn",
  }),

  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  compileServerImportMap,
  format: "commonjs",

  projectFileRequestedCallback: () => {},
  request: {
    origin: compileServerOrigin,
    ressource,
    method: "GET",
    headers: {},
  },
  babelPluginMap,
})
const expected = 200
assert({ actual, expected })

{
  const sourcemapFileUrl = `${compiledFileUrl}.map`
  const actual = JSON.parse(await readFileContent(urlToFileSystemPath(sourcemapFileUrl)))
  const expected = {
    version: 3,
    file: "file.js",
    sources: ["out/env.js", "../file.js"],
    sourcesContent: null,
    names: actual.names,
    mappings: actual.mappings,
  }
  assert({ actual, expected })
}

{
  const metaFileUrl = `${compiledFileUrl}__asset__/meta.json`
  const actual = JSON.parse(
    await readFileContent(urlToFileSystemPath(`${compiledFileUrl}__asset__/meta.json`)),
  )
  const expected = {
    contentType: "application/javascript",
    sources: ["../out/env.js", "../../file.js"],
    sourcesEtag: [
      bufferToEtag(readFileSync(urlToFileSystemPath(resolveUrl("../out/env.js", metaFileUrl)))),
      bufferToEtag(readFileSync(urlToFileSystemPath(resolveUrl("../../file.js", metaFileUrl)))),
    ],
    assets: ["../file.js.map"],
    assetsEtag: [
      bufferToEtag(readFileSync(urlToFileSystemPath(resolveUrl("../file.js.map", metaFileUrl)))),
    ],
    createdMs: actual.createdMs,
    lastModifiedMs: actual.lastModifiedMs,
  }
  assert({ actual, expected })
}

{
  const actual = import.meta.require(urlToFileSystemPath(compiledFileUrl))
  const expected = 42
  assert({ actual, expected })
}
