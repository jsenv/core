import { assert } from "@dmail/assert"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { startCompileServer } from "../../../index.js"
import { fetch } from "../fetch.js"

const projectFolder = ROOT_FOLDER
const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const serverCompileInto = `${testFolderRelative}/.dist`

const compileServer = await startCompileServer({
  projectFolder,
  serverCompileInto,
  verbose: true,
})

const response = await fetch(`${compileServer.origin}/.jsenv-well-known/system.js`)
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
