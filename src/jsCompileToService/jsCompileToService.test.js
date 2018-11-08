import { jsCompileToService } from "./jsCompileToService.js"
import { jsCompile } from "../jsCompile/index.js"
import assert from "assert"
import path from "path"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "build"
const compileId = "test"

const test = async () => {
  const jsService = jsCompileToService(jsCompile, {
    localRoot,
    compileInto,
  })

  {
    const response = await jsService({
      ressource: `${compileInto}/${compileId}/src/__test__/file.js`,
      method: "GET",
    })

    assert.equal(response.status, 200)
    assert(typeof response.headers.etag, "string")
  }

  {
    const response = await jsService({
      ressource: `${compileInto}/${compileId}/src/__test__/file.js__meta__/file.js.map`,
      method: "GET",
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers["content-type"], "application/json")
  }

  // ensure 404 on file not found
  {
    const response = await jsService({
      ressource: `${compileInto}/${compileId}/src/__test__/file.js:10`,
      method: "GET",
    })
    assert.equal(response.status, 404)
  }

  console.log("passed")
}

test()
