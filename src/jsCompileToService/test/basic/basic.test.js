import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../../localRoot.js"
import { jsCompile } from "../../../jsCompile/index.js"
import { jsCompileToService } from "../../jsCompileToService.js"

const compileInto = "build"
const compileId = "test"

;(async () => {
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
      ressource: `${compileInto}/${compileId}/src/jsCompileToService/test/basic/basic.js`,
      method: "GET",
    })

    assert({
      actual: response,
      expected: {
        ...response,
        status: 200,
        headers: {
          ...response.headers,
          "content-length": 269,
          "content-type": "application/javascript",
          eTag: `"54-Yd2c2D1VgsR7OyJD1YIUp5mwb54"`,
        },
      },
    })

    assert({ actual: response.body.indexOf("export default"), expected: -1 })
  }

  {
    const response = await jsService({
      ressource: `${compileInto}/${compileId}/src/jsCompileToService/test/basic/basic.js__asset__/file.js.map`,
      method: "GET",
    })

    // now handled by an other file service
    assert({ actual: response, expected: null })
  }

  // ensure 404 on file not found
  {
    const response = await jsService({
      ressource: `${compileInto}/${compileId}/src/jsCompileToService/test/basic/basic.js:10`,
      method: "GET",
    })
    assert({ actual: response.status, expected: 404 })
  }

  console.log("passed")
})()
