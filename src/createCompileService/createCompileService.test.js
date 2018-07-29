import assert from "assert"
import path from "path"
import { createCompileService } from "./createCompileService.js"

const projectRoot = path.resolve(__dirname, "../../..")

const service = createCompileService({
  rootLocation: projectRoot,
})

service({
  method: "GET",
  url: "/src/__test__/file.js",
}).then((properties) => {
  assert.equal(properties.status, 200)
})
