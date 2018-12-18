import { getCompileMapLocalURL } from "../../compileProject/index.js"
import { teardownForOutput, teardownForOutputAndCoverageMap } from "../platformTeardown.js"
import { createLocaters } from "../createLocaters.js"
import { nodeToCompileId } from "./nodeToCompileId.js"
import { createImporter } from "./system/createImporter.js"
import { fetchSource } from "./fetchSource.js"
import { evalSource } from "./evalSource.js"

const setup = ({ localRoot, remoteRoot, compileInto }) => {
  const compileMapLocalURL = getCompileMapLocalURL({ localRoot, compileInto })
  // eslint-disable-next-line import/no-dynamic-require
  const compileMap = require(compileMapLocalURL)

  const compileId =
    nodeToCompileId({ name: "node", version: process.version.slice(1) }, compileMap) || "otherwise"

  const {
    fileToRemoteCompiledFile,
    fileToRemoteInstrumentedFile,
    fileToLocalFile,
    hrefToLocalFile,
  } = createLocaters({
    localRoot,
    remoteRoot,
    compileInto,
    compileId,
  })

  const importer = createImporter({
    fetchSource,
    evalSource,
    hrefToLocalFile,
    fileToRemoteCompiledFile,
  })

  platform.importFile = (file, { instrument = false, collectCoverage = false } = {}) => {
    const remoteCompiledFile = instrument
      ? fileToRemoteInstrumentedFile(file)
      : fileToRemoteCompiledFile(file)

    return importer.importFile(remoteCompiledFile).then(
      (namespace) => {
        if (collectCoverage) {
          return teardownForOutputAndCoverageMap(namespace)
        }
        return teardownForOutput(namespace)
      },
      (error) => {
        if (error && error.code === "MODULE_PARSE_ERROR") {
          error.message = error.message.replace(file, fileToLocalFile(file))
          throw error
        }
        if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
          throw error.error
        }
        throw error
      },
    )
  }
}

export const platform = {
  setup,
  importFile: () => {
    throw new Error(`platform importFile must be called after setup`)
  },
}
