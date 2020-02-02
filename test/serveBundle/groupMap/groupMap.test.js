/* eslint-disable import/max-dependencies */
import { readFileSync } from "fs"
import { assert } from "@jsenv/assert"
import { createLogger } from "@jsenv/logger"
import { createCancellationToken } from "@jsenv/cancellation"
import { resolveUrl, urlToRelativeUrl, urlToFileSystemPath, readFile } from "@jsenv/util"
import { require } from "../../../src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "../../../src/internal/compiling/startCompileServer.js"
import { bufferToEtag } from "../../../src/internal/compiling/compile-directory/bufferToEtag.js"
import { serveBundle } from "../../../src/internal/compiling/serveBundle.js"
import { jsenvBabelPluginMap } from "../../../src/jsenvBabelPluginMap.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const originalFileUrl = resolveUrl("./file.cjs", import.meta.url)
const compiledFileUrl = resolveUrl("./.jsenv/file.cjs", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const projectDirectoryUrl = jsenvCoreDirectoryUrl
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
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
const ressource = `/${outDirectoryRelativeUrl}file.cjs`
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
  const actual = JSON.parse(await readFile(sourcemapFileUrl))
  const expected = {
    version: 3,
    file: "file.cjs",
    sources: ["out/groupMap.json", "../file.cjs"],
    sourcesContent: null,
    names: actual.names,
    mappings: actual.mappings,
  }
  assert({ actual, expected })
}
{
  const metaFileUrl = `${compiledFileUrl}__asset__/meta.json`
  const actual = JSON.parse(await readFile(metaFileUrl))
  const expected = {
    contentType: "application/javascript",
    sources: ["../out/groupMap.json", "../../file.cjs"],
    sourcesEtag: [
      bufferToEtag(
        readFileSync(urlToFileSystemPath(resolveUrl("../out/groupMap.json", metaFileUrl))),
      ),
      bufferToEtag(readFileSync(urlToFileSystemPath(resolveUrl("../../file.cjs", metaFileUrl)))),
    ],
    assets: ["../file.cjs.map"],
    assetsEtag: [
      bufferToEtag(readFileSync(urlToFileSystemPath(resolveUrl("../file.cjs.map", metaFileUrl)))),
    ],
    createdMs: actual.createdMs,
    lastModifiedMs: actual.lastModifiedMs,
  }
  assert({ actual, expected })
}
{
  // eslint-disable-next-line import/no-dynamic-require
  const actual = typeof require(urlToFileSystemPath(compiledFileUrl))
  const expected = "object"
  assert({ actual, expected })
}
{
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
}
