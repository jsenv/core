import { createCompileJS } from "../createCompileJS/createCompileJS.js"
import { compileToFileCompile } from "./compileToFileCompile.js"
import { fileCompileJSToService } from "./fileCompileJSToService.js"
import assert from "assert"
import path from "path"

const root = path.resolve(__dirname, "../../..")
const cacheFolder = "build"
const compileFolder = "build__dynamic__"

const compileJS = createCompileJS()

const fileCompileJS = compileToFileCompile(compileJS, {
  root,
  cacheFolder,
  compileFolder,
  cacheIgnore: true,
})

const service = fileCompileJSToService(fileCompileJS, {
  root,
  cacheFolder,
  compileFolder,
  cacheDisabled: true,
})

service({
  ressource: `${compileFolder}/src/__test__/file.js`,
  method: "GET",
  headers: {
    "user-agent": `node/8.0`,
  },
})
  .then((properties) => {
    assert.equal(properties.status, 200)
    assert(properties.headers.vary.indexOf("User-Agent") > -1)
    const fileLocation = properties.headers["x-location"]
    assert(typeof fileLocation, "string")
    assert(typeof properties.headers.ETag, "string")

    return service({
      ressource: `${fileLocation}.map`,
      method: "GET",
      headers: {
        "user-agent": `node/8.0`,
      },
    }).then((properties) => {
      assert.equal(properties.status, 200)
      assert(properties.headers.vary.indexOf("User-Agent") > -1)
      assert.equal(properties.headers["content-type"], "application/json")
    })
  })
  .then(() => {
    // ensure 404 on file not found
    return service({
      method: "GET",
      ressource: `${compileFolder}/src/__test__/file.js:10`,
      headers: {
        "user-agent": `node/8.0`,
      },
    }).then((properties) => {
      assert.equal(properties.status, 404)
      console.log("passed")
    })
  })
