import { compileFileToService } from "./compileFileToService.js"
import { compile } from "../compile/index.js"
import { compileToCompileFile } from "../compileToCompileFile.js"
import assert from "assert"
import path from "path"

const root = path.resolve(__dirname, "../../../../")
const into = "build"
const compileId = "test"

const compileFile = compileToCompileFile(compile, {
  root,
  into,
})
const service = compileFileToService(compileFile, {
  root,
  into,
  cacheIgnore: true,
})

service({
  ressource: `${into}/${compileId}/src/__test__/file.js`,
  method: "GET",
})
  .then((response) => {
    assert.equal(response.status, 200)
    assert(typeof response.headers.etag, "string")

    return service({
      ressource: `${into}/${compileId}/src/__test__/file.js__meta__/file.js.map`,
      method: "GET",
    }).then((response) => {
      assert.equal(response.status, 200)
      assert.equal(response.headers["content-type"], "application/json")
    })
  })
  .then(() => {
    // ensure 404 on file not found
    return service({
      ressource: `${into}/${compileId}/src/__test__/file.js:10`,
      method: "GET",
    }).then((response) => {
      assert.equal(response.status, 404)
      console.log("passed")
    })
  })
