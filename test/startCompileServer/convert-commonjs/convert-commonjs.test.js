import { assert } from "@dmail/assert"
import { fileHrefToFolderRelativePath } from "../../fileHrefToFolderRelativePath.js"
import { startCompileServer } from "../../../index.js"
import { COMPILE_SERVER_TEST_PARAM } from "../../compile-server-test-param.js"
import { fetch } from "../../fetch.js"

const { convertCommonJsWithBabel } = import.meta.require("@jsenv/commonjs-converter")

const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const compileId = "best"
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAM,
  compileIntoRelativePath,
  convertMap: {
    [`${folderRelativePath}/cjs/`]: (options) =>
      convertCommonJsWithBabel({ ...options, processEnvNodeEnv: "production" }),
  },
})

await fetch(
  `${compileServer.origin}${compileIntoRelativePath}/${compileId}${folderRelativePath}/cjs/index.js`,
)
const fileResponse = await fetch(
  `${compileServer.origin}${compileIntoRelativePath}/${compileId}${folderRelativePath}/cjs/file.js`,
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
assert({ actual, expected })
