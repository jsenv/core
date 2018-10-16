import { compileToService } from "./compileToService.js"
import { createCompile } from "../createCompileJS/index.js"
import assert from "assert"
import path from "path"

const root = path.resolve(__dirname, "../../..")
const cacheFolder = "build"
const compileFolder = "build__dynamic__"

const compile = createCompile()

const service = compileToService(compile, {
  root,
  cacheFolder,
  compileFolder,
  cacheIgnore: true,
})

service({
  ressource: `${compileFolder}/src/__test__/file-with-syntax-error.js`,
  method: "GET",
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
