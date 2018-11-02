import { jsCompileFileToService } from "./jsCompileFileToService.js"
import { jsCompile } from "../jsCompile/index.js"
import { jsCompileToCompileFile } from "../jsCompileToCompileFile/index.js"
import assert from "assert"
import path from "path"

const root = path.resolve(__dirname, "../../../../")
const into = "build"
const compileId = "test"

const jsCompileFile = jsCompileToCompileFile(jsCompile, {
  root,
  into,
})
const jsService = jsCompileFileToService(jsCompileFile, {
  root,
  into,
  cacheIgnore: true,
})

jsService({
  ressource: `${into}/${compileId}/src/__test__/file.js`,
  method: "GET",
})
  .then((response) => {
    assert.equal(response.status, 200)
    assert(typeof response.headers.etag, "string")

    return jsService({
      ressource: `${into}/${compileId}/src/__test__/file.js__meta__/file.js.map`,
      method: "GET",
    }).then((response) => {
      assert.equal(response.status, 200)
      assert.equal(response.headers["content-type"], "application/json")
    })
  })
  .then(() => {
    // ensure 404 on file not found
    return jsService({
      ressource: `${into}/${compileId}/src/__test__/file.js:10`,
      method: "GET",
    }).then((response) => {
      assert.equal(response.status, 404)
      console.log("passed")
    })
  })
