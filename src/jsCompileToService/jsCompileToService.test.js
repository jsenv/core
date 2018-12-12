import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../localRoot.js"
import { jsCompile } from "../jsCompile/index.js"
import { jsCompileToService } from "./jsCompileToService.js"

const compileInto = "build"
const compileId = "test"

const test = async () => {
  const jsService = jsCompileToService(jsCompile, {
    localRoot,
    compileInto,
    compileParamMap: {
      [compileId]: {
        pluginMap: pluginOptionMapToPluginMap({
          "transform-modules-commonjs": {},
        }),
      },
    },
  })

  {
    const response = await jsService({
      ressource: `${compileInto}/${compileId}/src/__test__/file.js`,
      method: "GET",
    })

    assert({
      actual: response,
      expected: {
        ...response,
        status: 200,
        headers: {
          ...response.headers,
          "content-length": 280,
          "content-type": "application/javascript",
          eTag: `"54-Yd2c2D1VgsR7OyJD1YIUp5mwb54"`,
        },
      },
    })

    assert({ actual: response.body.indexOf("export default"), expected: -1 })
  }

  {
    const response = await jsService({
      ressource: `${compileInto}/${compileId}/src/__test__/file.js__meta__/file.js.map`,
      method: "GET",
    })

    assert({ actual: response.status, expected: 200 })
    assert({ actual: response.headers["content-type"], expected: "application/json" })
  }

  // ensure 404 on file not found
  {
    const response = await jsService({
      ressource: `${compileInto}/${compileId}/src/__test__/file.js:10`,
      method: "GET",
    })
    assert({ actual: response.status, expected: 404 })
  }

  console.log("passed")
}

test()
