import { compileToService } from "./compileToService.js"
import { createCompile } from "../createCompileJS/index.js"
import assert from "assert"
import path from "path"

const root = path.resolve(__dirname, "../../..")
const cacheFolder = "build"
const compileFolder = "build__dynamic__"

const compile = createCompile({
  createOptions: () => {
    return {
      instrument: true,
    }
  },
})

const service = compileToService(compile, {
  root,
  cacheFolder,
  compileFolder,
  cacheIgnore: true,
})

service({
  ressource: `${compileFolder}/src/__test__/file.js`,
  method: "GET",
  headers: {
    "user-agent": `node/8.0`,
  },
}).then((properties) => {
  assert.equal(properties.status, 200)

  console.log("passed")
})
