import { openChromiumClient } from "../openChromiumClient/openChromiumClient.js"
import { glob } from "glob-gitignore"
import ignore from "ignore"
import fs from "fs"
import path from "path"
import { createCoverageMap } from "istanbul-lib-coverage"

const mergeCoverage = (...coverages) => {
  // https://github.com/istanbuljs/istanbuljs/blob/5405550c3868712b14fd8bfe0cbd6f2e7ac42279/packages/istanbul-lib-coverage/lib/coverage-map.js#L43
  const mergedCoverageMap = coverages.reduce((previous, coverage) => {
    return previous.merge(coverage)
  }, createCoverageMap({}))

  return mergedCoverageMap.toJSON()
}

export const testProject = ({
  server,
  createClient = () => openChromiumClient({ server }),
  root = process.cwd(),
  beforeAll = () => {},
  beforeEach = () => {},
  afterEach = () => {},
  afterAll = () => {},
  sourceInclude = ["index.js", "src/**/*.js"],
  testInclude = ["index.test.js", "src/**/*.test.js"],
  sourceExclude = [...testInclude],
  testExclude = [],
  getTestIgnoreString = () => {
    const filename = path.resolve(process.cwd(), root, ".testignore")

    return new Promise((resolve, reject) => {
      fs.readFile(filename, (error, buffer) => {
        if (error) {
          if (error && error.code === "ENOENT") {
            resolve("")
          }
          reject(error)
        } else {
          resolve(buffer.toString())
        }
      })
    })
  },
}) => {
  const absoluteLocation = path.resolve(process.cwd(), root)

  // https://github.com/kaelzhang/node-ignore
  // https://github.com/kaelzhang/node-glob-gitignore
  // https://karma-runner.github.io/latest/config/plugins.html
  // https://karma-runner.github.io/latest/dev/plugins.html
  // https://www.npmjs.com/package/glob#options
  const getSourceFiles = () => {
    return glob(sourceInclude, {
      nodir: true,
      cwd: absoluteLocation,
      ignore: sourceExclude,
    })
  }

  const getTestFiles = () => {
    return getTestIgnoreString()
      .then((ignoreRules) =>
        ignore()
          .add(testExclude)
          .add(ignoreRules),
      )
      .then((ignore) =>
        glob(testInclude, {
          nodir: true,
          cwd: absoluteLocation,
          ignore: ignore._rules.map(({ origin }) => origin),
        }),
      )
  }

  return Promise.all([createClient(), getTestFiles(), getSourceFiles()]).then(
    ([client, testFiles, sourceFiles]) => {
      testFiles = testFiles.map((testFile) => {
        return {
          path: testFile,
          type: "test",
        }
      })
      sourceFiles = sourceFiles.map((sourceFile) => {
        return {
          path: sourceFile,
          type: "source",
        }
      })

      const files = [...testFiles, ...sourceFiles]

      const getFileByPath = (path) => files.find((file) => file.path === path)

      beforeAll({ files })
      return Promise.all(
        testFiles.map((testFile) => {
          beforeEach({ file: testFile })

          return client
            .execute({
              file: testFile.path,
              collectCoverage: true,
              executeTest: true,
              autoClose: true,
            })
            .then(({ promise }) => promise)
            .then(({ namespace, test, coverage }) => {
              // test = null means file.test.js do not set a global.__test
              // which happens if file.test.js does not use @dmail/test or is empty for instance
              // coverage = null means file.test.js do not set a global.__coverage__
              // which happens if file.test.js was not instrumented.
              // this is not supposed to happen so we should throw ?
              testFile.namespace = namespace
              testFile.test = test
              Object.keys(coverage).forEach((path) => {
                const sourceFile = getFileByPath(path)
                sourceFile.coverage = sourceFile.coverage
                  ? mergeCoverage(sourceFile.coverage, coverage[path])
                  : coverage[path]
              })

              afterEach({ file: testFile })
            })
        }),
      )
        .then(() => {
          afterAll({ files })

          const untestedSourceFiles = sourceFiles.filter((sourceFile) => {
            return !sourceFile.coverage
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
            untestedSourceFiles.map((sourceFile) => {
              return getEmptyCoverageFor(sourceFile).then((missingCoverage) => {
                sourceFile.coverage = missingCoverage
              })
            }),
          )
        })
        .then(() => {
          return files
        })
    },
  )
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
