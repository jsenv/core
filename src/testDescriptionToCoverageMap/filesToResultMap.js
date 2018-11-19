import { createCancellationToken } from "@dmail/cancellation"
import { promiseConcurrent } from "../promiseHelper.js"
import { teardownForOutputAndCoverageMap } from "../platformTeardown.js"

export const filesToResultMap = (
  files,
  execute,
  {
    cancellationToken = createCancellationToken,
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
      cancellationToken,
      file,
      instrument: true,
      teardown: teardownForOutputAndCoverageMap,
    }).then(({ output, coverageMap }) => {
      if (coverageMap === null) {
        // coverageMap can be null for 2 reason:
        // - test file import a source file which is not instrumented
        // here we should throw
        // - test file import nothing so global__coverage__ is not set
        // here it's totally normal
        // throw new Error(`missing coverageMap after ${file} execution, it was not instrumented`)
      }

      afterEach({ file, output, coverageMap })

      return { output, coverageMap }
    })
  }

  beforeAll({ files })

  return promiseConcurrent(files, executeTestFile, {
    cancellationToken,
    maxParallelExecution,
  }).then((results) => {
    afterAll({ files, results })

    const resultMap = {}
    files.forEach((file, index) => {
      const result = results[index]
      resultMap[file] = result
    })

    return resultMap
  })
}
