import { promiseConcurrent } from "../promiseHelper.js"
import { coverageMapCompose } from "./coverageMapCompose.js"
import { teardownForOutputAndCoverage } from "../platformTeardown.js"
import { cancellationNone } from "../cancel/index.js"

// import { objectMapKey } from "./objectHelper.js"

// const getRelativenameFromPath = (path, root) => {
//   return path.startsWith(root) ? path.slice(root.length) + 1 : path
// }

export const getCoverageMapAndOutputMapForFiles = ({
  cancellation = cancellationNone,
  execute,
  files,
  maxParallelExecution = 5,
  beforeAll = () => {},
  beforeEach = () => {},
  afterEach = () => {},
  afterAll = () => {},
}) => {
  const executeTestFile = (file) => {
    beforeEach({ file })

    return execute({
      cancellation,
      file,
      teardown: teardownForOutputAndCoverage,
    }).then(({ output, coverage }) => {
      // coverage = null means file do not set a global.__coverage__
      // which happens if file was not instrumented.
      // this is not supposed to happen so we should throw ?

      afterEach({ file, output, coverage })

      return { output, coverage }
    })
  }

  beforeAll({ files })

  return promiseConcurrent(files, executeTestFile, {
    cancellation,
    maxParallelExecution,
  }).then((results) => {
    afterAll({ files, results })

    const outputMap = {}
    results.forEach(({ output }, index) => {
      const relativeName = files[index]
      outputMap[relativeName] = output
    })

    const coverageMap = coverageMapCompose(results.map(({ coverage }) => coverage))

    return { outputMap, coverageMap }
  })
}
