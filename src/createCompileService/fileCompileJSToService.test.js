import { createCompileJS } from "../createCompileJS/createCompileJS.js"
import { compileToFileCompile } from "./compileToFileCompile.js"
import { fileCompileJSToService } from "./fileCompileJSToService.js"
import assert from "assert"
import path from "path"
import { URL } from "url"

const root = path.resolve(__dirname, "../../..")

const compileJS = createCompileJS()

const fileCompileJS = compileToFileCompile(compileJS, {
  root,
  cacheFolderName: "build",
  compileFolderName: "compiled",
  cacheDisabled: true,
})

const service = fileCompileJSToService(fileCompileJS, {
  cacheFolderName: "build",
  compileFolderName: "compiled",
})

service({
  method: "GET",
  url: new URL("compiled/src/__test__/file.js", "file:///"),
  headers: {
    "user-agent": `node/8.0`,
  },
})
  .then((properties) => {
    assert.equal(properties.status, 200)
    // also ensure we have vary by user-agent
    console.log("ok")
  })
  .then(() => {
    service({
      method: "GET",
      url: new URL("build/src/__test__/file.js.map", "file:///"),
      headers: {
        "user-agent": `node/8.0`,
      },
    }).then((properties) => {
      assert.equal(properties.status, 200)
      // also ensure we have vary by user-agent
      assert.equal(properties.body.path.endsWith(".map"), true) // nodejs readable stream to the .map file
      console.log("ok")
    })
  })

// service({
//   method: "GET",
//   url: new URL("compiled/src/__test__/file.js:100:10", "file:///"),
//   headers: {
//     "user-agent": `node/8.0`,
//   },
// }).then((properties) => {
//   assert.equal(properties.status, 404)
// })
