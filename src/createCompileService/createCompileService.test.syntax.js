import assert from "assert"
import path from "path"
import { createCompileService } from "./createCompileService.js"
import { URL } from "url"

const root = path.resolve(__dirname, "../../..")

const { service } = createCompileService({
  rootLocation: root,
})

service({
  method: "GET",
  url: new URL("compiled/src/__test__/file-with-syntax-error.js", "file:///"),
  headers: {
    "user-agent": `node/8.0`,
  },
}).then((properties) => {
  // le serveur doit repondre un truc mais quoi
  // je me vois mal repondre 200, mais a part ca j'ai aue 500
  // sauf que sur 500 le serveur se ferme puisqu'il croit a une erreur imprevue
  assert.equal(properties.status, 500)
  assert.deepEqual(properties.headers["content-type"], "application/json")
  assert.deepEqual(JSON.parse(properties.body), {
    name: "PARSE_ERROR",
    message:
      "src/__test__/file-with-syntax-error.js: Unexpected token (2:0)\n\n  1 | const a = (\n> 2 | \n    | ^",
    fileName: "src/__test__/file-with-syntax-error.js",
    lineNumber: 2,
    columnNumber: 0,
  })

  console.log("passed")
})
