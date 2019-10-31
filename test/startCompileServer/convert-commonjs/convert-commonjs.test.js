import { assert } from "@dmail/assert"
import { resolveDirectoryUrl, resolveFileUrl, fileUrlToRelativePath } from "src/private/urlUtils.js"
import { startCompileServer } from "../../../index.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS.js"
import { fetch } from "../fetch.js"

const { convertCommonJsWithBabel } = import.meta.require("@jsenv/commonjs-converter")
const compileDirectoryUrl = resolveDirectoryUrl("./.dist", import.meta.url)
const fileUrl = resolveFileUrl("./file.js", import.meta.url)
const fileRelativePath = fileUrlToRelativePath(
  fileUrl,
  COMPILE_SERVER_TEST_PARAMS.projectDirectoryUrl,
)
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  compileDirectoryUrl,
  convertMap: {
    [fileRelativePath]: (options) =>
      convertCommonJsWithBabel({ ...options, processEnvNodeEnv: "production" }),
  },
})
const fileServerUrl = `${compileServer.origin}/.dist/best/${fileRelativePath}`

const fileResponse = await fetch(fileServerUrl)
const actual = {
  status: fileResponse.status,
  statusText: fileResponse.statusText,
  headers: fileResponse.headers,
}
const expected = {
  status: 200,
  statusText: "OK",
  headers: {
    ...actual.headers,
    "content-type": ["application/javascript"],
  },
}
assert({ actual, expected })
