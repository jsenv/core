import { createCoverageMap } from "istanbul-lib-coverage"
import { executeParallel } from "./executeParallel.js"
import { createSignal } from "@dmail/signal"

const objectMapKey = (object, callback) => {
  const mappedObject = {}
  Object.keys(object).forEach((key) => {
    mappedObject[callback(key)] = object[key]
  })
  return mappedObject
}

const objectComposeValue = (previous, object, callback) => {
  const composedObject = {}

  Object.keys(object).forEach((key) => {
    const value = object[key]
    composedObject[key] = key in previous ? callback(value, previous[key]) : value
  })

  return composedObject
}

export const mergeCoverageMap = (...coverageMaps) => {
  // https://github.com/istanbuljs/istanbuljs/blob/5405550c3868712b14fd8bfe0cbd6f2e7ac42279/packages/istanbul-lib-coverage/lib/coverage-map.js#L43
  const coverageMapMerged = coverageMaps.reduce(
    (previous, coverageMap) => previous.merge(coverageMap),
    createCoverageMap({}),
  )
  return coverageMapMerged.toJSON()
}

export const composeCoverageMap = (...coverageMaps) => {
  return coverageMaps.reduce((previous, coverageMap) => {
    return {
      ...previous,
      ...objectComposeValue(previous, coverageMap, mergeCoverageMap),
    }
  }, {})
}

const getRelativenameFromPath = (path, root) => path.slice(root.length) + 1

export const getCoverageMapAndOutputMapForFiles = ({
  localRoot,
  remoteRoot,
  remoteCompileDestination,
  createClient,
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

  const promise = createClient({ localRoot, remoteRoot, remoteCompileDestination }).then(
    (client) => {
      const executeTestFile = (file) => {
        beforeEach({ file })

        return client
          .execute({
            file: file.relativeName,
            // teardown : faut le construire
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
      return executeParallel(executeTestFile, files, { maxParallelExecution }).then((results) => {
        afterAll({ files, results })

        const outputMap = {}
        results.forEach(({ output }, index) => {
          const relativeName = files[index]
          outputMap[relativeName] = output
        })

        const coverageMap = composeCoverageMap(results.map(({ coverage }) => coverage))

        return { outputMap, coverageMap }
      })
    },
  )

  return { promise, cancel }
}

export const getCoverageMapMissed = (coverageMap, files, compileFile) => {
  const getEmptyCoverageFor = (file) => {
    // we must compileFile to get the coverage object
    // without evaluating the file source because it would increment coverage
    // and also execute code that is not supposed to be run
    return compileFile(file).then(({ outputAssets }) => {
      const coverageAsset = outputAssets.find((asset) => asset.name === "coverage")
      const coverage = JSON.parse(coverageAsset.content)
      // https://github.com/gotwarlost/istanbul/blob/bc84c315271a5dd4d39bcefc5925cfb61a3d174a/lib/command/common/run-with-cover.js#L229
      Object.keys(coverage.s).forEach(function(key) {
        coverage.s[key] = 0
      })
      return coverage
    })
  }

  const coverageMapMissed = {}
  return Promise.all(
    files.map((file) => {
      return getEmptyCoverageFor(file).then((emptyCoverage) => {
        coverageMapMissed[file] = emptyCoverage
      })
    }),
  ).then(() => coverageMapMissed)
}

// make path absolute because relative path may not work, to be verified
export const absolutizeCoverageMap = (relativeCoverageMap, root) => {
  return objectMapKey(relativeCoverageMap, (relativeName) => `${root}/${relativeName}`)
}
