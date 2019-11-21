/* eslint-disable import/max-dependencies */
import { readFileSync } from "fs"
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
import { bufferToEtag } from "internal/compiling/compile-directory/bufferToEtag.js"
import { jsenvBabelPluginMap } from "src/jsenvBabelPluginMap.js"
import { serveBundle } from "src/serveBundle.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const projectDirectoryUrl = jsenvCoreDirectoryUrl
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const compileDirectoryRelativeUrl = `${jsenvDirectoryRelativeUrl}${COMPILE_DIRECTORY}/`
const originalFileUrl = import.meta.resolve("./file.js")
const compiledFileUrl = import.meta.resolve(`./.jsenv/file.js`)
const babelPluginMap = jsenvBabelPluginMap
const compileServer = await startCompileServer({
  compileServerLogLevel: "warn",
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean: true,
  babelPluginMap,
  env: {
    whatever: 42,
  },
})
const serveBundleParams = {
  cancellationToken: createCancellationToken(),
  logger: createLogger({ logLevel: "warn" }),

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
}
const response = await serveBundle(serveBundleParams)

{
  const { status: actual } = response
  const expected = 200
  assert({ actual, expected })
}

{
  const sourcemapFileUrl = `${compiledFileUrl}.map`
  const actual = JSON.parse(await readFileContent(fileUrlToPath(sourcemapFileUrl)))
  const expected = {
    version: 3,
    file: "file.js",
    sources: ["groupMap.json", "../file.js"],
    sourcesContent: [
      `export default ${await readFileContent(
        fileUrlToPath(resolveFileUrl("groupMap.json", sourcemapFileUrl)),
      )}`,
      await readFileContent(fileUrlToPath(resolveFileUrl("../file.js", sourcemapFileUrl))),
    ],
    names: actual.names,
    mappings: actual.mappings,
  }
  assert({ actual, expected })
}

{
  const metaFileUrl = `${compiledFileUrl}__asset__/meta.json`
  const actual = JSON.parse(await readFileContent(fileUrlToPath(metaFileUrl)))
  const expected = {
    contentType: "application/javascript",
    sources: ["../groupMap.json", "../../file.js"],
    sourcesEtag: [
      bufferToEtag(readFileSync(fileUrlToPath(resolveFileUrl("../groupMap.json", metaFileUrl)))),
      bufferToEtag(readFileSync(fileUrlToPath(resolveFileUrl("../../file.js", metaFileUrl)))),
    ],
    assets: ["../file.js.map"],
    assetsEtag: ['"7ed-ydFjTMuM8PXpodF3jSsUHbi9BEI"'],
    createdMs: actual.createdMs,
    lastModifiedMs: actual.lastModifiedMs,
  }
  assert({ actual, expected })
}

{
  const actual = typeof import.meta.require(fileUrlToPath(compiledFileUrl))
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
