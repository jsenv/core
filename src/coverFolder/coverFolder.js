import { createCoverageMap } from "istanbul-lib-coverage"
import { createFileStructure } from "@dmail/project-structure"
import { openChromiumClient } from "../openChromiumClient/openChromiumClient.js"
import { executeParallel } from "./executeParallel.js"

const createOutputMapFromOutputs = (outputs) => {
  const outputMap = {}
  outputs.forEach(({ output, relativeName }) => {
    outputMap[relativeName] = output
  })
  return outputMap
}

const mergeCoverage = (...coverages) => {
  // https://github.com/istanbuljs/istanbuljs/blob/5405550c3868712b14fd8bfe0cbd6f2e7ac42279/packages/istanbul-lib-coverage/lib/coverage-map.js#L43
  const mergedCoverageMap = coverages.reduce((previous, coverage) => {
    return previous.merge(coverage)
  }, createCoverageMap({}))

  return mergedCoverageMap.toJSON()
}

const getRelativenameFromPath = (path, root) => path.slice(root.length) + 1

const createCoverageMapFromCoverages = (coverages, root) => {
  const coverageMap = {}

  coverages.forEach((coverage) => {
    Object.keys(coverage).forEach((path) => {
      const relativeName = getRelativenameFromPath(path, root)
      const coverageForPath = coverage[path]

      coverageMap[relativeName] =
        relativeName in coverageMap
          ? mergeCoverage(coverageMap[relativeName], coverageForPath)
          : coverageForPath
    })
  })

  return coverageMap
}

const fileIsTestPredicate = ({ test }) => Boolean(test)

const fileMustBeCoveredPredicate = ({ cover }) => Boolean(cover)

const metaPredicate = (meta) => fileIsTestPredicate(meta) || fileMustBeCoveredPredicate(meta)

const getFiles = ({ root }) => {
  return createFileStructure({ root }).then(({ forEachFileMatching }) => {
    return forEachFileMatching(metaPredicate, ({ relativeName, meta }) => {
      return {
        relativeName,
        test: fileIsTestPredicate(meta),
        cover: fileMustBeCoveredPredicate(meta),
      }
    })
  })
}

// je sais pas encore comment, mais certain fichier pourrait specifier
// dans quel platform il doivent (peuvent) se run.
// genre export const acceptPlatforms = [{ name: 'node'}, { name: 'chrome'}]
// et donc selon ca vscode demarre chrome ou nodejs pour le debug
// et le code coverage run le fichier dans les plateformes listées
// a priori je verrais plus ca dans structure.config.js
// qui va dire
// testChrome: { pattern of file to test on chrome}
// testFirefox: { pattern of file to test on firefox}
// testNode: { pattern of file to test on node}

export const testProject = ({
  root,
  server,
  // we must not have a default createClient like that
  // it must be specified manually from outside
  createClient = ({ remoteRoot }) => openChromiumClient({ remoteRoot }),
  beforeAll = () => {},
  beforeEach = () => {},
  afterEach = () => {},
  afterAll = () => {},
}) => {
  return Promise.all([
    createClient({ locaRoot: root, remoteRoot: server.url.toString().slice(0, -1) }),
    getFiles({ root }),
  ]).then(([client, files]) => {
    const testFiles = files.filter(({ test }) => test)
    const mustBeCoveredFiles = files.filter(({ cover }) => cover)

    const executeTestFile = (file) => {
      beforeEach({ file })

      return client
        .execute({
          file: file.relativeName,
          // teardown : faut le construire
          autoClose: true,
        })
        .then(({ promise }) => promise)
        .then(({ output, coverage }) => {
          // test = null means file.test.js do not set a global.__test
          // which happens if file.test.js does not use @dmail/test or is empty for instance
          // coverage = null means file.test.js do not set a global.__coverage__
          // which happens if file.test.js was not instrumented.
          // this is not supposed to happen so we should throw ?
          // testFile.output = output

          afterEach({ file, output, coverage })

          return { output, coverage }
        })
    }

    beforeAll({ files: testFiles })
    return executeParallel(executeTestFile, testFiles, { maxParallelExecution: 5 }).then(
      (results) => {
        afterAll({ files: testFiles, results })

        const outputMap = createOutputMapFromOutputs(
          results.map(({ output }, index) => {
            return {
              output,
              relativeName: testFiles[index],
            }
          }),
        )

        const coverageMap = createCoverageMapFromCoverages(results.map(({ coverage }) => coverage))

        const uncoveredFiles = mustBeCoveredFiles.filter(({ relativeName }) => {
          return relativeName in coverageMap === false
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
          uncoveredFiles.map(({ relativeName }) => {
            return getEmptyCoverageFor(relativeName).then((emptyCoverage) => {
              coverageMap[relativeName] = emptyCoverage
            })
          }),
        ).then(() => {
          return { files, outputMap, coverageMap }
        })
      },
    )
  })
}

export const absolutizeCoverageMap = (coverageMap, root) => {
  const coverage = {}

  // make path absolute because relative path may not work, to be verified
  Object.keys(coverageMap).forEach((relativeName) => {
    coverage[`${root}/${relativeName}`] = coverageMap[relativeName]
  })

  return coverage
}
