import { assert } from "@dmail/assert"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { startCompileServer } from "../../../index.js"
import { fetch } from "../fetch.js"

const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const projectFolder = ROOT_FOLDER
const compileInto = `${testFolderRelative}/.dist`

const compileServer = await startCompileServer({
  projectFolder,
  compileInto,
  verbose: false,
})

const response = await fetch(
  `${compileServer.origin}/${compileInto}/otherwise/${testFolderRelative}/file.js`,
)
const actual = {
  status: response.status,
  statusText: response.statusText,
  headers: response.headers,
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
