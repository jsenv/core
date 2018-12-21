import { createCancellationToken } from "@dmail/cancellation"
import { promiseConcurrent } from "../promiseHelper.js"
import { executeFileOnPlatform } from "../executeFileOnPlatform/index.js"

export const filesToResultMap = async (
  files,
  launchPlatform,
  {
    cancellationToken = createCancellationToken,
    maxParallelExecution = 5,
    beforeAll = () => {},
    beforeEach = () => {},
    afterEach = () => {},
    afterAll = () => {},
  } = {},
) => {
  const resultMap = {}

  beforeAll({ files })
  await promiseConcurrent(
    files,
    async (file) => {
      beforeEach({ file })
      const result = await executeFileOnPlatform(file, launchPlatform, {
        cancellationToken,
        instrument: true,
        collectCoverage: true,
      })
      afterEach({ file, output, coverageMap })

      const { output, coverageMap } = result
      if (coverageMap === null) {
        // coverageMap can be null for 2 reason:
        // - test file import a source file which is not instrumented
        // here we should throw
        // - test file import nothing so global__coverage__ is not set
        // here it's totally normal
        // throw new Error(`missing coverageMap after ${file} execution, it was not instrumented`)
      }
      resultMap[file] = result
      return result
    },
    {
      cancellationToken,
      maxParallelExecution,
    },
  )
  afterAll({ files, resultMap })

  return resultMap
}
