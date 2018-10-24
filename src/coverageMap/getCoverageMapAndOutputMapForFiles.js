import { createSignal } from "@dmail/signal"
import { promiseConcurrent } from "../promiseHelper.js"
import { coverageMapCompose } from "./coverageMapCompose.js"
import { teardownForOutputAndCoverage } from "../platformTeardown.js"
import { promiseToCancellablePromise } from "../cancellable/index.js"

// import { objectMapKey } from "./objectHelper.js"

// const getRelativenameFromPath = (path, root) => {
//   return path.startsWith(root) ? path.slice(root.length) + 1 : path
// }

export const getCoverageMapAndOutputMapForFiles = ({
  execute,
  files,
  maxParallelExecution = 5,
  beforeAll = () => {},
  beforeEach = () => {},
  afterEach = () => {},
  afterAll = () => {},
}) => {
  const cancelled = createSignal({ smart: true })

  const executeTestFile = (file) => {
    beforeEach({ file })

    const execution = execute({
      file,
      teardown: teardownForOutputAndCoverage,
    })
    cancelled.listenOnce(execution.cancel)

    return execution.then(({ output, coverage }) => {
      // coverage = null means file do not set a global.__coverage__
      // which happens if file was not instrumented.
      // this is not supposed to happen so we should throw ?

      afterEach({ file, output, coverage })

      return { output, coverage }
    })
  }

  beforeAll({ files })

  const promise = promiseConcurrent(files, executeTestFile, { maxParallelExecution }).then(
    (results) => {
      afterAll({ files, results })

      const outputMap = {}
      results.forEach(({ output }, index) => {
        const relativeName = files[index]
        outputMap[relativeName] = output
      })

      const coverageMap = coverageMapCompose(results.map(({ coverage }) => coverage))

      return { outputMap, coverageMap }
    },
  )

  return promiseToCancellablePromise(promise, cancelled)
}
