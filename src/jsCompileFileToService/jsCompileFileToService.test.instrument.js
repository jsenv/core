import { jsCompileFileToService } from "./jsCompileFileToService.js"
import { jsCompile, createInstrumentPlugin } from "../jsCompile/index.js"
import { jsCompileToCompileFile } from "../jsCompileToCompileFile/index.js"
import assert from "assert"
import path from "path"

const root = path.resolve(__dirname, "../../../../")
const into = "build"
const compileId = "compileId"

const compileFile = jsCompileToCompileFile(jsCompile, {
  root,
  into,
})
const jsService = jsCompileFileToService(compileFile, {
  root,
  into,
  compileParamMap: {
    [compileId]: {
      plugins: [createInstrumentPlugin()],
    },
  },
  cacheIgnore: true,
})

jsService({
  ressource: `${into}/${compileId}/src/__test__/file.js`,
  method: "GET",
}).then((response) => {
  assert.equal(response.status, 200)
  assert.equal(response.body.indexOf("__coverage__") > -1, true)

  console.log("passed")
})
