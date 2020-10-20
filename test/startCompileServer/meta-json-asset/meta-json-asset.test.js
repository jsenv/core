import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { fetchUrl } from "@jsenv/server"
import { COMPILE_ID_OTHERWISE } from "../../../src/internal/CONSTANTS.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS.js"

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
const fileServerUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/${fileRelativeUrl}`
await fetchUrl(fileServerUrl, { ignoreHttpsError: true })
const response = await fetchUrl(`${fileServerUrl}__asset__meta.json`, { ignoreHttpsError: true })
const body = await response.json()
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
    sources: [`../../../../../../${filename}`],
    sourcesEtag:
      // it fails on windows because windows got \r\n and etag differs
      process.platform === "win32" ? actual.body.sourcesEtag : ['"7c-b5QcrFoIrKrXSr5F415m5RCd6uY"'],
    assets: [`${filename}.map`],
    assetsEtag: ['"f0-bxeoZF9Aw0804N/SDnLk8R1QdGY"'],
    createdMs: actual.body.createdMs,
    lastModifiedMs: actual.body.lastModifiedMs,
  },
}
assert({ actual, expected })
