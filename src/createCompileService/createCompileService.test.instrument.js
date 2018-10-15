import assert from "assert"
import path from "path"
import { createCompileService } from "./createCompileService.js"
import { URL } from "url"
import { createCompile } from "../createCompile/createCompile.js"

const root = path.resolve(__dirname, "../../..")

const compile = createCompile({
  createOptions: () => {
    return {
      transpile: true,
      instrument: true,
      remap: true,
    }
  },
})

const { service } = createCompileService({
  rootLocation: root,
  compile,
  cacheDisabled: true,
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
