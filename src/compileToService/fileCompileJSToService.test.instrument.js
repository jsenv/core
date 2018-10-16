import { createCompileJS } from "../createCompileJS/createCompileJS.js"
import { compileToFileCompile } from "./compileToFileCompile.js"
import { fileCompileJSToService } from "./fileCompileJSToService.js"
import assert from "assert"
import path from "path"

const root = path.resolve(__dirname, "../../..")
const cacheFolder = "build"
const compileFolder = "build__dynamic__"

const compileJS = createCompileJS({
  createOptions: () => {
    return {
      instrument: true,
    }
  },
})

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
}).then((properties) => {
  assert.equal(properties.status, 200)

  console.log("passed")
})
