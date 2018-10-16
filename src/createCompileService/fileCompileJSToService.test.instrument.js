import { createCompileJS } from "../createCompileJS/createCompileJS.js"
import { compileToFileCompile } from "./compileToFileCompile.js"
import { fileCompileJSToService } from "./fileCompileJSToService.js"
import assert from "assert"
import path from "path"
import { URL } from "url"

const root = path.resolve(__dirname, "../../..")

const compileJS = createCompileJS({
  createOptions: () => {
    return {
      transpile: true,
      instrument: true,
      remap: true,
    }
  },
})

const fileCompileJS = compileToFileCompile(compileJS, {
  root,
  cacheFolderName: "build",
  compileFolderName: "compiled",
  cacheDisabled: true,
})

const service = fileCompileJSToService(fileCompileJS, {
  cacheFolderName: "build",
  compileFolderName: "compiled",
})

service({
  method: "GET",
  url: new URL("compiled/src/__test__/file.js", "file:///"),
  headers: {
    "user-agent": `node/8.0`,
  },
}).then((properties) => {
  // le serveur doit repondre un truc mais quoi
  // je me vois mal repondre 200, mais a part ca j'ai aue 500
  // sauf que sur 500 le serveur se ferme puisqu'il croit a une erreur imprevue
  assert.equal(properties.status, 200)

  console.log("passed")
})
