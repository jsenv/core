import { openChromiumClient } from "../openChromiumClient/openChromiumClient.js"
import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { glob } from "glob-gitignore"
import ignore from "ignore"
import fs from "fs"
import path from "path"

// TODO; currently collectCOverage is dumb, we may wnat to control test execution
// and not just execute the file

export const getFolderCoverage = ({
  root = process.cwd(),
  sourceInclude = ["**/*.js"],
  testInclude = ["**/*.test.*"],
  sourceExclude = ["**/*.map", testInclude],
  testExclude = ["**/*.map"],
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
    Promise.all([getChromiumClient(), getTestFiles()]).then(
      ([{ chomiumClient, compileFile }, testFiles]) => {
        const getCoverageFor = (file) => {
          // we must? execute coverage in the same browser page but execute creates a new page for each call
          // otherwise the global coverage object is not updated
          return chomiumClient
            .execute({
              file,
              collectCoverage: true,
            })
            .then(({ coverage }) => coverage)
        }

        return Promise.all([testFiles.map((file) => getCoverageFor(file))]).then((coverages) => {
          // here we have the list of all coverage object collected after test execution
          // get the latest one
          // because all coverage are execute in different pages
          // we could just merge them ourselves ?
          // the fact we have several test files that may cover the same source file
          // means the coverage must be merged
          // it is auto handled if the coverage global object is mutated
          // otherwise we have to use istanbul merge util
          // my instinct tells me to favor the run each test file in different page approach
          // if we do that we're fine with the fact that chomiumClient.execute creates a new page
          // however each test file will run independently, this is to keep in mind
          // the console.log output (because runned in parallel) will be a mess
          // do not forget how it would work with node, node is not forking a new process for each execute
          // so this is a difference with chromium approach already
          // plus running in a different page means System.import will re fetch and execute the scripts
          // instead of hitting the cache
          // seems not desired
          let coverageWithMostKeys = coverages[0]
          coverages.forEach((coverage) => {
            if (Object.keys(coverage).length > Object.keys(coverageWithMostKeys).length) {
              coverageWithMostKeys = coverage
            }
          })
          chomiumClient.close()
          return { coverage: coverageWithMostKeys, compileFile }
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
