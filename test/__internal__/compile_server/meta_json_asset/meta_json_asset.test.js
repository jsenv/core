import { fetchUrl } from "@jsenv/server"
import {
  resolveUrl,
  urlToRelativeUrl,
  bufferToEtag,
  readFile,
} from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compile_server/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const fileRelativeUrl = `${testDirectoryRelativeUrl}meta_json_asset.js`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const { compileId } = await compileServer.createCompileIdFromRuntimeReport({})
const fileRelativeCompiledUrl = `${compileServer.jsenvDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`
const fileServerUrl = resolveUrl(fileRelativeCompiledUrl, compileServer.origin)
const fileUrl = resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl)
await fetchUrl(fileServerUrl, { ignoreHttpsError: true })
const response = await fetchUrl(`${fileServerUrl}__asset__meta.json`, {
  ignoreHttpsError: true,
})
const body = await response.json()
const mapCompiledRelativeUrl = `${fileRelativeCompiledUrl}.map`
const mapCompiledUrl = resolveUrl(mapCompiledRelativeUrl, jsenvCoreDirectoryUrl)
const actual = {
  status: response.status,
  statusText: response.statusText,
  contentType: response.headers.get("content-type"),
  body,
}
const expected = {
  status: 200,
  statusText: "OK",
  contentType: "application/json",
  body: {
    contentType: "application/javascript",
    sources: [`../../../../../../meta_json_asset.js`],
    sourcesEtag: [bufferToEtag(await readFile(fileUrl, { as: "buffer" }))],
    assets: [`meta_json_asset.js.map`],
    assetsEtag: [
      bufferToEtag(await readFile(mapCompiledUrl, { as: "buffer" })),
    ],
    dependencies: [],
    createdMs: actual.body.createdMs,
    lastModifiedMs: actual.body.lastModifiedMs,
  },
}
assert({ actual, expected })
