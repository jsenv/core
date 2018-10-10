import { openChromiumClient } from "../openChromiumClient/openChromiumClient.js"
import path from "path"
import { createCoverageMap } from "istanbul-lib-coverage"
import { createFileStructure } from "@dmail/project-structure"
import { executeParallel } from "./executeParallel.js"

const mergeCoverage = (...coverages) => {
  // https://github.com/istanbuljs/istanbuljs/blob/5405550c3868712b14fd8bfe0cbd6f2e7ac42279/packages/istanbul-lib-coverage/lib/coverage-map.js#L43
  const mergedCoverageMap = coverages.reduce((previous, coverage) => {
    return previous.merge(coverage)
  }, createCoverageMap({}))

  return mergedCoverageMap.toJSON()
}

const fileIsTestPredicate = ({ test }) => Boolean(test)

const fileMustBeCoveredPredicate = ({ cover }) => Boolean(cover)

const metaPredicate = (meta) => fileIsTestPredicate(meta) || fileMustBeCoveredPredicate(meta)

export const testProject = ({
  server,
  createClient = () => openChromiumClient({ compileURL: server.compileURL }),
  root = process.cwd(),
  beforeAll = () => {},
  beforeEach = () => {},
  afterEach = () => {},
  afterAll = () => {},
}) => {
  const rootLocation = path.resolve(process.cwd(), root)

  const getRequiredFileReport = createFileStructure({ root: rootLocation }).then(
    ({ forEachFileMatching }) => {
      return forEachFileMatching(metaPredicate, ({ relativeName, meta }) => {
        return { relativeName, meta }
      })
    },
  )

  return Promise.all([createClient(), getRequiredFileReport()]).then(([client, fileReport]) => {
    const testFiles = fileReport.filter(({ meta }) => fileIsTestPredicate(meta)).map((file) => {
      return {
        path: `${rootLocation}/${file.relativeName}`,
        type: "test",
      }
    })
    const mustBeCoveredFiles = fileReport
      .filter(({ meta }) => fileMustBeCoveredPredicate(meta))
      .map((file) => {
        return {
          path: `${rootLocation}/${file.relativeName}`,
          type: "source",
        }
      })
    const files = [...testFiles, ...mustBeCoveredFiles]

    const getFileByPath = (path) => files.find((file) => file.path === path)

    const executeTestFile = (testFile) => {
      beforeEach({ file: testFile })

      return client
        .execute({
          file: testFile.path,
          collectCoverage: true,
          executeTest: true,
          autoClose: true,
        })
        .then(({ promise }) => promise)
        .then(({ output, coverage }) => {
          // test = null means file.test.js do not set a global.__test
          // which happens if file.test.js does not use @dmail/test or is empty for instance
          // coverage = null means file.test.js do not set a global.__coverage__
          // which happens if file.test.js was not instrumented.
          // this is not supposed to happen so we should throw ?
          testFile.output = output
          Object.keys(coverage).forEach((path) => {
            const sourceFile = getFileByPath(path)
            sourceFile.coverage = sourceFile.coverage
              ? mergeCoverage(sourceFile.coverage, coverage[path])
              : coverage[path]
          })

          afterEach({ file: testFile })
        })
    }

    beforeAll({ files })
    return executeParallel(executeTestFile, testFiles, { maxParallelExecution: 5 })
      .then(() => {
        afterAll({ files })

        const uncoveredFiles = mustBeCoveredFiles.filter((mustBeCoveredFile) => {
          return !mustBeCoveredFile.coverage
        })

        const getEmptyCoverageFor = (file) => {
          // we must compileFile to get the coverage object
          // without evaluating the file source because it would increment coverage
          // and also execute code that is not supposed to be run
          return server.compileFile(file).then(({ outputAssets }) => {
            const coverageAsset = outputAssets.find((asset) => asset.name === "coverage")
            const coverage = JSON.parse(coverageAsset.content)
            // https://github.com/gotwarlost/istanbul/blob/bc84c315271a5dd4d39bcefc5925cfb61a3d174a/lib/command/common/run-with-cover.js#L229
            Object.keys(coverage.s).forEach(function(key) {
              coverage.s[key] = 0
            })
            return coverage
          })
        }

        return Promise.all(
          uncoveredFiles.map((mustBeCoveredFile) => {
            return getEmptyCoverageFor(mustBeCoveredFile).then((emptyCoverage) => {
              mustBeCoveredFile.coverage = emptyCoverage
            })
          }),
        )
      })
      .then(() => {
        return files
      })
  })
}

export const createCoverageFromTestReport = (files) => {
  const coverage = {}

  files.forEach((file) => {
    if (file.coverage) {
      coverage[file.coverage.path] = file.coverage
    }
  })

  return coverage
}
