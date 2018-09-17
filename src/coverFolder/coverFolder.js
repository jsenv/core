import { openChromiumClient } from "../openChromiumClient/openChromiumClient.js"
import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { glob } from "glob-gitignore"
import ignore from "ignore"
import fs from "fs"
import path from "path"
import { createCoverageMap } from "istanbul-lib-coverage"

export const getFolderCoverage = ({
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

  const getChromiumClient = () => {
    return openCompileServer({
      rootLocation: root,
      transpile: true,
      sourceMap: "comment",
      minify: false,
      optimize: false,
      instrument: true,
    }).then((server) => {
      return openChromiumClient({
        server,
        headless: true,
      }).then((chromiumClient) => {
        return {
          chromiumClient,
          compileFile: server.compileFile,
        }
      })
    })
  }

  const getCoverage = () => {
    return Promise.all([getChromiumClient(), getTestFiles()]).then(
      ([{ chomiumClient, compileFile }, testFiles]) => {
        beforeAll({ files: testFiles })

        const getCoverageFor = (file) => {
          beforeEach({ file })
          return chomiumClient
            .execute({
              file,
              collectCoverage: true,
              executeTest: true,
              autoClose: true,
            })
            .then(({ promise }) => promise)
            .then(({ coverage, test }) => {
              afterEach({ file, test, coverage })
              return coverage
            })
        }

        return Promise.all([testFiles.map((file) => getCoverageFor(file))]).then((coverages) => {
          // https://github.com/istanbuljs/istanbuljs/blob/5405550c3868712b14fd8bfe0cbd6f2e7ac42279/packages/istanbul-lib-coverage/lib/coverage-map.js#L43
          const mergedCoverageMap = coverages.reduce((previous, coverage) => {
            return previous.merge(coverage)
          }, createCoverageMap({}))

          const coverage = mergedCoverageMap.toJSON()

          afterAll({ files: testFiles, coverage })

          return { coverage, compileFile }
        })
      },
    )
  }

  return getCoverage().then(({ coverage, compileFile }) => {
    return getSourceFiles().then((sourceFiles) => {
      const untestedSourceFiles = sourceFiles.filter((sourceFile) => {
        return sourceFile in coverage === false
      })

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

      return Promise.all(
        untestedSourceFiles.map((sourceFile) => getEmptyCoverageFor(sourceFile)),
      ).then((missingCoverages) => {
        const finalCoverage = { ...coverage }

        missingCoverages.forEach((missingCoverage) => {
          finalCoverage[missingCoverage.path] = missingCoverage
        })

        return finalCoverage
      })
    })
  })
}
