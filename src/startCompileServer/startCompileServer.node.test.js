import { fromPromise } from "@dmail/action"
import { createNodeLoader } from "@dmail/module-loader/src/node/index.js"
import { test } from "@dmail/test"
import assert from "assert"
import path from "path"
import "./global-fetch.js"
import { startCompileServer } from "./startCompileServer.js"

const testImport = (relativeFileLocation) => {
  return startCompileServer({
    rootLocation: `${path.resolve(__dirname, "../../../src/__test__")}`,
  }).then(({ url, close }) => {
    const loader = createNodeLoader({ base: url.href })
    global.System = loader
    return fromPromise(loader.import(relativeFileLocation)).then((value) => {
      return close().then(() => value)
    })
  })
}

test(() => {
  return testImport("./file.js").then((bindings) => {
    assert.equal(bindings.default, true)
  })
})

test.skip(() => {
  return testImport("./file-with-node-es6-import.js").then((bindings) => {
    assert.equal(bindings.default, "aaabbb")
  })
})

test.skip(() => {
  return testImport("./file-with-relative-cjs-import.js").then((bindings) => {
    assert.equal(bindings.default, "cjs")
  })
})

test.skip(() => {
  return testImport("./file-cjs-and-native-require.js").then((bindings) => {
    assert.equal(bindings.default, "createServer")
  })
})
