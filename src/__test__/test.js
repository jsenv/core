import { createSignal } from "../../node_modules/@dmail/signal/index.js"

console.log("createSignal", createSignal)

// import { test } from "../../node_modules/@dmail/test/index.js"
// import { fromPromise } from "../../node_modules/@dmail/action/index.js"
// import assert from "assert"

// const testImport = (relativeFileLocation) => {
//   return fromPromise(global.System.import(relativeFileLocation))
// }

// test(() => {
//   return testImport("./file.js").then((bindings) => {
//     assert.equal(bindings.default, true)
//   })
// })

// test.skip(() => {
//   return testImport("./file-with-node-es6-import.js").then((bindings) => {
//     assert.equal(bindings.default, "aaabbb")
//   })
// })

// test.skip(() => {
//   return testImport("./file-with-relative-cjs-import.js").then((bindings) => {
//     assert.equal(bindings.default, "cjs")
//   })
// })

// test.skip(() => {
//   return testImport("./file-cjs-and-native-require.js").then((bindings) => {
//     assert.equal(bindings.default, "createServer")
//   })
// })
