import { assert } from "@dmail/assert"
import { projectFolder } from "../../../projectFolder.js"
import { jsCompile } from "../../../jsCompile/index.js"
import { jsCompileToService } from "../../jsCompileToService.js"

const compileInto = "build"
const compileId = "test"

;(async () => {
  const jsService = jsCompileToService(jsCompile, {
    projectFolder,
    compileInto,
    compileDescription: {
      [compileId]: {
        babelPluginDescription: {},
      },
    },
  })

  {
    const response = await jsService({
      ressource: `/${compileInto}/${compileId}/src/jsCompileToService/test/basic/basic.js`,
      method: "GET",
    })

    assert({
      actual: response,
      expected: {
        ...response,
        status: 200,
        headers: {
          ...response.headers,
          "content-type": "application/javascript",
        },
      },
    })

    assert({ actual: response.body.indexOf("export default"), expected: -1 })
  }

  {
    const response = await jsService({
      ressource: `/${compileInto}/${compileId}/src/jsCompileToService/test/basic/basic.js__asset__/file.js.map`,
      method: "GET",
    })

    // now handled by an other file service
    assert({ actual: response, expected: null })
  }

  // ensure 404 on file not found
  {
    const response = await jsService({
      ressource: `/${compileInto}/${compileId}/src/jsCompileToService/test/basic/basic.js:10`,
      method: "GET",
    })
    assert({ actual: response.status, expected: 404 })
  }
})()
