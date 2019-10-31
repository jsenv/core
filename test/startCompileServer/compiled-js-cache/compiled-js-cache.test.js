import { assert } from "@dmail/assert"
import { fileHrefToFolderRelativePath } from "../../fileHrefToFolderRelativePath.js"
import { jsenvCompileServerPath } from "../../../src/jsenvCompileServerPath.js"
import { startCompileServer } from "../../../index.js"
import { fetch } from "../../fetch.js"
import { COMPILE_SERVER_TEST_PARAM } from "../../compile-server-test-param.js"

const rimraf = import.meta.require("rimraf")

const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const compileId = "otherwise"
const fileRelativePath = `${folderRelativePath}/file.js`

const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAM,
  compileIntoRelativePath,
})

await new Promise((resolve, reject) =>
  rimraf(`${jsenvCompileServerPath}${compileIntoRelativePath}`, (error) => {
    if (error) reject(error)
    else resolve()
  }),
)
const firstResponse = await fetch(
  `${compileServer.origin}${compileIntoRelativePath}/${compileId}${fileRelativePath}`,
)
const secondResponse = await fetch(
  `${compileServer.origin}${compileIntoRelativePath}/${compileId}${fileRelativePath}`,
  {
    headers: {
      "if-none-match": firstResponse.headers.etag[0],
    },
  },
)
const actual = {
  status: secondResponse.status,
  statusText: secondResponse.statusText,
  headers: secondResponse.headers,
}
const expected = {
  status: 304,
  statusText: "Not Modified",
  headers: actual.headers,
}
assert({ actual, expected })
