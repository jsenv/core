import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { startCompileServer } from "../../../index.js"
import { fetch } from "../fetch.js"

const projectFolder = ROOT_FOLDER
const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const testFolderRelative = testFolder.slice(`${ROOT_FOLDER}/`.length)
const compileInto = `${testFolderRelative}/.dist`

const compileServer = await startCompileServer({
  projectFolder,
  compileInto,
  verbose: true,
})

const response = await fetch(`${compileServer.origin}/${compileInto}/JSENV_NODE_CLIENT.js`)
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
