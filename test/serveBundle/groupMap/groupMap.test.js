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
} from "@jsenv/util"
import { readFileContent } from "internal/filesystemUtils.js"
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
const serveBundleParams = {
  cancellationToken: createCancellationToken(),
  logger: createLogger({ logLevel: "warn" }),

  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  outDirectoryRelativeUrl,
  originalFileUrl,
  compiledFileUrl,
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
}
const response = await serveBundle(serveBundleParams)

{
  const { status: actual } = response
  const expected = 200
  assert({ actual, expected })
}

{
  const sourcemapFileUrl = `${compiledFileUrl}.map`
  const actual = JSON.parse(await readFileContent(urlToFileSystemPath(sourcemapFileUrl)))
  const expected = {
    version: 3,
    file: "file.js",
    sources: ["out/groupMap.json", "../file.js"],
    sourcesContent: null,
    names: actual.names,
    mappings: actual.mappings,
  }
  assert({ actual, expected })
}

{
  const metaFileUrl = `${compiledFileUrl}__asset__/meta.json`
  const actual = JSON.parse(await readFileContent(urlToFileSystemPath(metaFileUrl)))
  const expected = {
    contentType: "application/javascript",
    sources: ["../out/groupMap.json", "../../file.js"],
    sourcesEtag: [
      bufferToEtag(readFileSync(urlToFileSystemPath(resolveUrl("../out/groupMap.json", metaFileUrl)))),
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
  const actual = typeof import.meta.require(urlToFileSystemPath(compiledFileUrl))
  const expected = "object"
  assert({ actual, expected })
}

// ensure serveBundle cache works
const secondResponse = await serveBundle({
  ...serveBundleParams,
  request: {
    ...serveBundleParams.request,
    headers: {
      "if-none-match": response.headers.eTag,
    },
  },
})
const actual = secondResponse.status
const expected = 304
assert({ actual, expected })
