import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { startCompileServer } from "../../../index.js"
import { fetch } from "../fetch.js"

const rimraf = import.meta.require("rimraf")

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const projectFolder = JSENV_PATH
const compileInto = `${folderJsenvRelativePath}/.dist`

const compileServer = await startCompileServer({
  projectFolder,
  compileInto,
  logLevel: "off",
})

await new Promise((resolve, reject) =>
  rimraf(`${projectFolder}/${compileInto}`, (error) => {
    if (error) reject(error)
    else resolve()
  }),
)
const firstResponse = await fetch(
  `${compileServer.origin}/${compileInto}/otherwise/${folderJsenvRelativePath}/file.js`,
)
const secondResponse = await fetch(
  `${compileServer.origin}/${compileInto}/otherwise/${folderJsenvRelativePath}/file.js`,
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

assert({
  actual,
  expected,
})
