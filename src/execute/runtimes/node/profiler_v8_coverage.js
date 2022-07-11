/*
 * Calling Profiler.startPreciseCoverage DO NOT propagate to
 * subprocesses (new Worker or child_process.fork())
 * So the best solution remains NODE_V8_COVERAGE
 * This profiler strategy remains useful when:
 * - As fallback when NODE_V8_COVERAGE is not configured
 * - If explicitely enabled with coverageMethodForNodeJs: 'Profiler'
 *   - Used by jsenv during automated tests about coverage
 *   - Anyone prefering this approach over NODE_V8_COVERAGE and assuming
 *     it will not fork subprocess or don't care if coverage is missed for this code
 * - https://v8.dev/blog/javascript-code-coverage#for-embedders
 * - https://github.com/nodejs/node/issues/28283
 * - https://vanilla.aslushnikov.com/?Profiler.startPreciseCoverage
 */

import { Session } from "node:inspector"

export const startJsCoverage = async ({
  callCount = true,
  detailed = true,
} = {}) => {
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

  await postSession("Profiler.enable")
  await postSession("Profiler.startPreciseCoverage", { callCount, detailed })

  const takeJsCoverage = async () => {
    const coverage = await postSession("Profiler.takePreciseCoverage")
    return coverage
  }

  const stopJsCoverage = async () => {
    const coverage = await takeJsCoverage()
    await postSession("Profiler.stopPreciseCoverage")
    await postSession("Profiler.disable")
    return coverage
  }

  return {
    takeJsCoverage,
    stopJsCoverage,
  }
}
