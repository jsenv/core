import { Session } from "node:inspector"

import { Worker } from "node:worker_threads"

const session = new Session()
session.connect()
const postSession = (action, options) => {
  const promise = new Promise((resolve, reject) => {
    session.post(action, options, (error, data) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
  return promise
}

// the approach below works but the worker is not part of the coverage
// I guess we would have to enable the profiler in the worker
// but it's not possible because we cannot mock Worker in the worker
// it shows that worker are not part of Profiler coverage
// -> we must use NODE_V8_COVERAGE
// to achieve this the simplest solution is to start the
// execute_test_plan with NODE_V8_COVERAGE variable
await postSession("Profiler.enable")
// https://v8.dev/blog/javascript-code-coverage#for-embedders
// https://github.com/nodejs/node/issues/28283
// https://vanilla.aslushnikov.com/?Profiler.startPreciseCoverage
await postSession("Profiler.startPreciseCoverage", {
  callCount: true,
  detailed: true,
})
await new Promise((resolve) => {
  setTimeout(resolve, 500)
})

// eslint-disable-next-line no-new
new Worker(new URL("./worker.js", import.meta.url))

const coverage = await postSession("Profiler.takePreciseCoverage")
await postSession("Profiler.stopPreciseCoverage")
await postSession("Profiler.disable")
console.log(coverage)
