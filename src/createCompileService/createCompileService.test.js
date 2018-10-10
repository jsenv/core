import assert from "assert"
import path from "path"
import { createCompileService } from "./createCompileService.js"
import { URL } from "url"

const projectRoot = path.resolve(__dirname, "../../..")

const { service } = createCompileService({
  rootLocation: projectRoot,
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
    console.log("ok")
  })
  .then(() => {
    service({
      method: "GET",
      url: new URL("compiled/src/__test__/file.js.map", "file:///"),
      headers: {
        "user-agent": `node/8.0`,
      },
    }).then((properties) => {
      assert.equal(properties.status, 200)
      assert.equal(properties.body.path.endsWith(".map"), true) // nodejs readable stream to the .map file
      console.log("ok")
    })
  })
