/* eslint-disable import/max-dependencies */
import { readFileSync } from "fs"
import { assert } from "@jsenv/assert"
import { createLogger } from "@jsenv/logger"
import { createCancellationToken } from "@jsenv/cancellation"
import {
  resolveUrl,
  urlToRelativeUrl,
  urlToFileSystemPath,
  readFile,
  bufferToEtag,
} from "@jsenv/util"
import { require } from "../../../src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "../../../src/internal/compiling/startCompileServer.js"
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
const metaFileUrl = `${compiledFileUrl}__asset__meta.json`
const envFileUrl = resolveUrl("out/env.json", metaFileUrl)

const response = await serveBundle({
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
{
  const actual = response.status
  const expected = 200
  assert({ actual, expected })
}
{
  const sourcemapFileUrl = `${compiledFileUrl}.map`
  const actual = JSON.parse(await readFile(sourcemapFileUrl))
  const expected = {
    version: 3,
    file: "file.cjs",
    sources: ["out/env.json", "../file.cjs"],
    sourcesContent: null,
    names: actual.names,
    mappings: actual.mappings,
  }
  assert({ actual, expected })
}
{
  const sourcemapFileUrl = resolveUrl("file.cjs.map", metaFileUrl)
  const actual = JSON.parse(await readFile(`${compiledFileUrl}__asset__meta.json`))
  const expected = {
    contentType: "application/javascript",
    sources: ["out/env.json", "../file.cjs"],
    sourcesEtag: [
      bufferToEtag(readFileSync(urlToFileSystemPath(envFileUrl))),
      bufferToEtag(readFileSync(urlToFileSystemPath(originalFileUrl))),
    ],
    assets: ["file.cjs.map"],
    assetsEtag: [bufferToEtag(readFileSync(urlToFileSystemPath(sourcemapFileUrl)))],
    createdMs: actual.createdMs,
    lastModifiedMs: actual.lastModifiedMs,
  }
  assert({ actual, expected })
}
{
  // eslint-disable-next-line import/no-dynamic-require
  const actual = require(urlToFileSystemPath(compiledFileUrl))
  const expected = {
    whatever: 42,
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importMapFileRelativeUrl: "importMap.json",
  }
  assert({ actual, expected })
}
