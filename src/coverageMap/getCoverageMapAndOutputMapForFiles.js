import { createSignal } from "@dmail/signal"
import { promiseConcurrent } from "./promiseHelper.js"
import { coverageMapCompose } from "./coverageMapCompose.js"
import { objectMapKey } from "./objectHelper.js"

const getRelativenameFromPath = (path, root) => path.slice(root.length) + 1

const teardown = (namespace) => {
  return Promise.resolve(namespace.output).then((output) => {
    const globalObject = typeof window === "object" ? window : global

    return {
      output,
      coverage: "__coverage__" in globalObject ? globalObject.__coverage__ : null,
    }
  })
}

export const getCoverageMapAndOutputMapForFiles = ({
  localRoot,
  execute,
  files,
  maxParallelExecution = 5,
  beforeAll = () => {},
  beforeEach = () => {},
  afterEach = () => {},
  afterAll = () => {},
}) => {
  const cancelled = createSignal({ smart: true })
  const cancel = () => {
    cancelled.emit()
  }

  const executeTestFile = (file) => {
    beforeEach({ file })

    return execute({
      file: file.relativeName,
      teardown,
      autoClose: true,
    })
      .then(({ promise, cancel }) => {
        cancelled.listenOnce(cancel)
        return promise
      })
      .then(({ output, coverage }) => {
        coverage = objectMapKey(coverage, (path) => getRelativenameFromPath(path, localRoot))
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

  return { promise, cancel }
}
