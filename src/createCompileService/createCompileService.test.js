import assert from "assert"
import path from "path"
import { createCompileService } from "./createCompileService.js"
import { URL } from "url"
import { createHeaders } from "../openServer/createHeaders.js"

const projectRoot = path.resolve(__dirname, "../../..")

const { service } = createCompileService({
  rootLocation: projectRoot,
})

service({
  method: "GET",
  url: new URL("compiled/src/__test__/file.js", "file:///"),
  headers: createHeaders({
    "user-agent": `node/8.0`,
  }),
}).then((properties) => {
  assert.equal(properties.status, 200)
  console.log("ok")
})

// service({
//   method: "GET",
//   url: new URL("compiled/src/__test__/file.js.map", "file:///"),
//   headers: createHeaders({
//     "user-agent": `node/8.0`,
//   }),
// }).then((properties) => {
//   assert.equal(properties.status, 200)
//   console.log("ok")
// })
