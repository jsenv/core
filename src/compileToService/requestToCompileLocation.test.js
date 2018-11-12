import { requestToCompileLocation } from "./requestToCompileLocation.js"
import assert from "assert"

{
  const localRoot = "root"
  const compileInto = "build"
  const actual = requestToCompileLocation(
    {
      origin: "http://127.0.0.1",
      ressource: "build/foo/node_modules/dependency/node_modules/package/index.js",
      headers: {
        referer: "http://127.0.0.1/build/foo/node_modules/dependency/index.js",
      },
    },
    {
      localRoot,
      compileInto,
    },
  )
  const expected = {
    compileId: "foo",
    file: "node_modules/package/index.js",
    parentFile: "node_modules/dependency/index.js",
    localFile: "root/node_modules/dependency/node_modules/package/index.js",
  }
  assert.equal(actual, expected)
}

console.log("passed")
