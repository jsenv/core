/**
 * cannot really be tested for now because:
 *
 * convertCommonJsWithBabel exported by @jsenv/commonjs-converter
 * uses transformJs which but @jsenv/commonjs-converter package.json
 * does not contain @jsenv/core
 *
 * @jsenv/commonjs-converter is something we will also absorb back here
 * especially because it introduces only a fwe new dependencies
 * and is part of jsenv overall features
 *
 *
 */

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
const compileDirectoryRelativePath = fileUrlToRelativePath(
  compileDirectoryUrl,
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
const fileServerUrl = `${compileServer.origin}/${compileDirectoryRelativePath}best/${fileRelativePath}`

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
