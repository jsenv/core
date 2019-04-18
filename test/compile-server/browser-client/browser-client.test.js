import { assert } from "@dmail/assert"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { startCompileServer } from "../../../index.js"
import { fetch } from "../fetch.js"

const projectFolder = ROOT_FOLDER
const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const compileInto = `${testFolderRelative}/.dist`

const compileServer = await startCompileServer({
  projectFolder,
  compileInto,
  verbose: true,
})

const response = await fetch(`${compileServer.origin}/${compileInto}/JSENV_BROWSER_CLIENT.js`)
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
    "access-control-allow-credentials": ["true"],
    "access-control-allow-headers": ["x-requested-with, content-type, accept"],
    "access-control-allow-methods": ["GET, POST, PUT, DELETE, OPTIONS"],
    "access-control-allow-origin": ["*"],
    "access-control-max-age": ["1"],
    connection: ["close"],
    "content-type": ["application/javascript"],
  },
}

assert({
  actual,
  expected,
})
