import { jsCompileFileToService } from "./jsCompileFileToService.js"
import { jsCompile } from "../jsCompile/index.js"
import { jsCompileToCompileFile } from "../jsCompileToCompileFile/index.js"
import assert from "assert"
import path from "path"

const root = path.resolve(__dirname, "../../../../")
const into = "build"
const compileId = "compileId"

const jsCompileFile = jsCompileToCompileFile(jsCompile, {
  root,
  into,
})
const jsService = jsCompileFileToService(jsCompileFile, {
  root,
  into,
  cacheIgnore: true,
})

jsService({
  ressource: `${into}/${compileId}/src/__test__/file-with-syntax-error.js`,
  method: "GET",
}).then((response) => {
  // le serveur doit repondre un truc mais quoi
  // je me vois mal repondre 200, mais a part ca j'ai aue 500
  // sauf que sur 500 le serveur se ferme puisqu'il croit a une erreur imprevue
  assert.equal(response.status, 500)
  assert.deepEqual(response.headers["content-type"], "application/json")

  const error = JSON.parse(response.body)
  assert.deepEqual(error, {
    name: "PARSE_ERROR",
    message:
      "src/__test__/file-with-syntax-error.js: Unexpected token (2:0)\n\n  1 | const a = (\n> 2 | \n    | ^",
    fileName: "src/__test__/file-with-syntax-error.js",
    lineNumber: 2,
    columnNumber: 0,
  })

  console.log("passed")
})
