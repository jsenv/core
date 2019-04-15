import path from "path"
import assert from "assert"
import { jsCompileToService } from "../../../jsCompileToService/jsCompileToService.js"
import { jsCompile } from "../../../jsCompile/index.js"
import { createInstrumentPlugin } from "../../../cover/createInstrumentPlugin.js"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = ".dist"
const compileId = "compileId"

const test = async () => {
  const jsService = jsCompileToService(jsCompile, {
    localRoot,
    compileInto,
    compileDescription: {
      [compileId]: {
        babelConfigMap: {
          "transform-instrument": createInstrumentPlugin(),
        },
      },
    },
  })

  const response = await jsService({
    ressource: `/${compileInto}/${compileId}/src/jsCompileToService/test/basic/basic.js`,
    method: "GET",
  })
  assert.equal(response.status, 200)
  assert.equal(response.body.indexOf("__coverage__") > -1, true)

  console.log("passed")
}

test()
