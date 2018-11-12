import { compileToService } from "./compileToService.js"
import assert from "assert"

const test = async () => {
  // locate with referer
  {
    const compileService = compileToService(() => {}, {
      localRoot: "root",
      compileInto: "build",
      locate: (file, localDependentFile) =>
        Promise.reject({
          code: "LOCATE_ERROR",
          file,
          localDependentFile,
        }),
    })

    try {
      await compileService({
        origin: "http://127.0.0.1",
        ressource: "build/foo/node_modules/dependency/node_modules/package/index.js",
        headers: {
          referer: "http://127.0.0.1/build/foo/node_modules/dependency/index.js",
        },
      })
      assert.fail("must not be called")
    } catch (actual) {
      const expected = {
        code: "LOCATE_ERROR",
        file: "node_modules/package/index.js",
        localDependentFile: "root/node_modules/dependency/index.js",
      }
      assert.deepEqual(actual, expected)
    }
  }

  console.log("passed")
}

test()
