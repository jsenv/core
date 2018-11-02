import { promiseConcurrent } from "../promiseHelper.js"
import { teardownForOutputAndCoverage } from "../platformTeardown.js"
import { cancellationNone } from "../cancel/index.js"

export const filesToResultMap = (
  files,
  execute,
  {
    cancellation = cancellationNone,
    maxParallelExecution = 5,
    beforeAll = () => {},
    beforeEach = () => {},
    afterEach = () => {},
    afterAll = () => {},
  } = {},
) => {
  const executeTestFile = (file) => {
    beforeEach({ file })

    return execute({
      cancellation,
      file,
      instrument: true,
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

    const resultMap = {}
    files.forEach((file, index) => {
      const result = results[index]
      resultMap[file] = {
        output: result.output,
        coverageMap: result.coverage,
      }
    })

    return resultMap
  })
}
