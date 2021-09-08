import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, bufferToEtag, readFile } from "@jsenv/filesystem"
import { fetchUrl } from "@jsenv/server"
import { COMPILE_ID_OTHERWISE } from "@jsenv/core/src/internal/CONSTANTS.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const filename = `${testDirectoryname}.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`

const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const fileRelativeCompiledUrl = `${outDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/${fileRelativeUrl}`
const fileServerUrl = resolveUrl(fileRelativeCompiledUrl, compileServerOrigin)
const fileUrl = resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl)
await fetchUrl(fileServerUrl, { ignoreHttpsError: true })
const response = await fetchUrl(`${fileServerUrl}__asset__meta.json`, { ignoreHttpsError: true })
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
    sources: [`../../../../../../../${filename}`],
    sourcesEtag: [bufferToEtag(await readFile(fileUrl, { as: "buffer" }))],
    assets: [`${filename}.map`],
    assetsEtag: [bufferToEtag(await readFile(mapCompiledUrl, { as: "buffer" }))],
    createdMs: actual.body.createdMs,
    lastModifiedMs: actual.body.lastModifiedMs,
  },
}
assert({ actual, expected })
