import { compileFileToService } from "./compileFileToService.js"
import { compile } from "../compile/index.js"
import { compileToCompileFile } from "../compileToCompileFile.js"
import { pluginNameToPlugin } from "@dmail/project-structure-compile-babel"
import assert from "assert"
import path from "path"

const root = path.resolve(__dirname, "../../../../")
const into = "build"
const compileId = "compileId"

const compileFile = compileToCompileFile(compile, {
  root,
  into,
  compileParamMap: {
    [compileId]: {
      plugins: [pluginNameToPlugin("transform-block-scoping")],
    },
  },
})
const service = compileFileToService(compileFile, {
  root,
  into,
  cacheIgnore: true,
})

service({
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
