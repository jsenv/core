import { createCancellationToken } from "@dmail/cancellation"
import { promiseConcurrent } from "../promiseHelper.js"

export const filesToResultMap = async (
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
  beforeAll({ files })
  const results = await promiseConcurrent(
    files,
    async (file) => {
      beforeEach({ file })

      // todo: certainly not execute anymore but we'll receive lancuhPlatform
      // and we will use executeFileOnPlatform()
      const { output, coverageMap } = execute({
        cancellationToken,
        file,
        instrument: true,
        collectCoverage: true,
      })
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
    },
    {
      cancellationToken,
      maxParallelExecution,
    },
  )
  afterAll({ files, results })

  const resultMap = {}
  files.forEach((file, index) => {
    const result = results[index]
    resultMap[file] = result
  })

  return resultMap
}
