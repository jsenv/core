import { readFileSync } from "fs"
import { assert } from "@jsenv/assert"
import { fetchUrl } from "@jsenv/server"
import {
  resolveUrl,
  urlToRelativeUrl,
  urlToFileSystemPath,
  readFile,
  bufferToEtag,
} from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { COMPILE_ID_BUILD_COMMONJS } from "@jsenv/core/src/internal/CONSTANTS.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"

const projectDirectoryUrl = jsenvCoreDirectoryUrl
const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.cjs`

const compileServer = await startCompileServer({
  compileServerLogLevel: "warn",
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean: true,
  env: {
    whatever: 42,
  },
})
const buildDirectoryRelativeUrl = `${compileServer.outDirectoryRelativeUrl}${COMPILE_ID_BUILD_COMMONJS}/`
const fileBuildServerUrl = `${compileServer.origin}/${buildDirectoryRelativeUrl}${fileRelativeUrl}`
const fileBuildUrl = `${projectDirectoryUrl}${buildDirectoryRelativeUrl}${fileRelativeUrl}`

const response = await fetchUrl(fileBuildServerUrl)
{
  const actual = response.status
  const expected = 200
  assert({ actual, expected })
}

const sourcemapFileUrl = `${fileBuildUrl}.map`
{
  const actual = await readFile(sourcemapFileUrl, { as: "json" })
  const expected = {
    version: 3,
    file: "file.cjs",
    sources: ["../../../../env.json", "../../../../../../file.cjs"],
    sourcesContent: null,
    names: actual.names,
    mappings: actual.mappings,
  }
  assert({ actual, expected })
}

const fileBuildMetaUrl = `${fileBuildUrl}__asset__meta.json`
const envFileUrl = resolveUrl(
  "env.json",
  `${projectDirectoryUrl}${compileServer.outDirectoryRelativeUrl}`,
)
const fileUrl = resolveUrl(fileRelativeUrl, projectDirectoryUrl)
{
  const actual = await readFile(fileBuildMetaUrl, { as: "json" })
  const expected = {
    contentType: "application/javascript",
    sources: ["../../../../env.json", "../../../../../../file.cjs"],
    sourcesEtag: [
      bufferToEtag(readFileSync(urlToFileSystemPath(envFileUrl))),
      bufferToEtag(readFileSync(urlToFileSystemPath(fileUrl))),
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
  const actual = require(urlToFileSystemPath(fileBuildUrl)).value
  const expected = {
    whatever: 42,
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl: compileServer.outDirectoryRelativeUrl,
    importMapFileRelativeUrl: "import-map.importmap",
  }
  assert({ actual, expected })
}
