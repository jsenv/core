import { compileFileToService } from "./compileFileToService.js"
import { compile, createInstrumentPlugin } from "../compile/index.js"
import { compileToCompileFile } from "../compileToCompileFile.js"
import assert from "assert"
import path from "path"

const root = path.resolve(__dirname, "../../../../")
const into = "build"
const compileId = "compileId"

const compileFile = compileToCompileFile(compile, {
  root,
  into,
})
const service = compileFileToService(compileFile, {
  root,
  into,
  compileParamMap: {
    [compileId]: {
      plugins: [createInstrumentPlugin()],
    },
  },
  cacheIgnore: true,
})

service({
  ressource: `${into}/${compileId}/src/__test__/file.js`,
  method: "GET",
}).then((response) => {
  assert.equal(response.status, 200)
  assert.equal(response.body.indexOf("__coverage__") > -1, true)

  console.log("passed")
})
