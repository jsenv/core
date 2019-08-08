import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startCompileServer, convertCommonJs } from "../../../index.js"
import { COMPILE_SERVER_TEST_PARAM } from "../compile-server-test-param.js"
import { fetch } from "../fetch.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const compileId = "best"
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAM,
  compileIntoRelativePath,
  convertMap: {
    [`${folderJsenvRelativePath}/cjs/`]: (options) =>
      convertCommonJs({ ...options, nodeEnv: 42, replaceGlobalByGlobalThis: true }),
  },
})

await fetch(
  `${compileServer.origin}${compileIntoRelativePath}/${compileId}${folderJsenvRelativePath}/cjs/index.js`,
)
const fileResponse = await fetch(
  `${compileServer.origin}${compileIntoRelativePath}/${compileId}${folderJsenvRelativePath}/cjs/file.js`,
)
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

assert({
  actual,
  expected,
})
