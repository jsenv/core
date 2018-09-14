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
      })
    })
  }

  const getCoverage = () => {
    Promise.all([getChromiumClient(), getTestFiles()]).then(([chomiumClient, testFiles]) => {
      const getCoverageFor = (file) => {
        return chomiumClient
          .execute({
            file,
            collectCoverage: true,
          })
          .then(({ coverage }) => coverage)
      }

      const teardown = () => chomiumClient.close()

      return Promise.all([testFiles.map((file) => getCoverageFor(file))]).then((coverages) => {
        // here we have the list of all coverage object collected after test execution
        // get the latest one
        let coverageWithMostKeys = coverages[0]
        coverages.forEach((coverage) => {
          if (Object.keys(coverage).length > Object.keys(coverageWithMostKeys).length) {
            coverageWithMostKeys = coverage
          }
        })
        return { coverage: coverageWithMostKeys, getCoverageFor, teardown }
      })
    })
  }

  return getCoverage().then(({ coverage, getCoverageFor, teardown }) => {
    return getSourceFiles().then((sourceFiles) => {
      const untestedSourceFiles = sourceFiles.filter((sourceFile) => {
        return sourceFile in coverage === false
      })

      const getMissingCoverageFor = (file) => {
        return getCoverageFor(file).then((coverage) => {
          // https://github.com/gotwarlost/istanbul/blob/bc84c315271a5dd4d39bcefc5925cfb61a3d174a/lib/command/common/run-with-cover.js#L229
          Object.keys(coverage.s).forEach(function(key) {
            coverage.s[key] = 0
          })
          return coverage
        })
      }

      return Promise.all(
        untestedSourceFiles.map((sourceFile) => getMissingCoverageFor(sourceFile)),
      ).then((missingCoverages) => {
        teardown() // close chromium client
        const finalCoverage = { ...coverage }

        missingCoverages.forEach((missingCoverage) => {
          finalCoverage[missingCoverage.path] = missingCoverage
        })

        return finalCoverage
      })
    })
  })
}
