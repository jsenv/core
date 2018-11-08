import { jsCompileToService } from "./jsCompileToService.js"
import { jsCompile, createInstrumentPlugin } from "../jsCompile/index.js"
import assert from "assert"
import path from "path"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "build"
const compileId = "compileId"

const test = async () => {
  const jsService = jsCompileToService(jsCompile, {
    localRoot,
    compileInto,
    compileParamMap: {
      [compileId]: {
        plugins: [createInstrumentPlugin()],
      },
    },
  })

  const response = await jsService({
    ressource: `${compileInto}/${compileId}/src/__test__/file.js`,
    method: "GET",
  })
  assert.equal(response.status, 200)
  assert.equal(response.body.indexOf("__coverage__") > -1, true)

  console.log("passed")
}

test()
