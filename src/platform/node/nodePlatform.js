import {
  ressourceToRemoteCompiledFile,
  ressourceToRemoteInstrumentedFile,
  ressourceToLocalSourceFile,
} from "../locaters.js"
import { getCompileMapLocalURL } from "./localURL.js"
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

  const importer = createImporter({
    remoteRoot,
    localRoot,
    compileInto,
    compileId,
    fetchSource,
    evalSource,
  })

  // maybe rename importProjectRessource or something specific
  // because you can only import file from your localRoot
  // you cannot import file:// or http:// or whatever
  platform.importFile = async (
    file,
    { collectNamespace = false, collectCoverage = false, instrument = collectCoverage } = {},
  ) => {
    const remoteCompiledFile = instrument
      ? ressourceToRemoteInstrumentedFile({ ressource: file, remoteRoot, compileInto, compileId })
      : ressourceToRemoteCompiledFile({ ressource: file, remoteRoot, compileInto, compileId })

    try {
      const namespace = await importer.importFile(remoteCompiledFile)
      if (collectCoverage) {
        await namespace.output
      }
      return {
        ...(collectNamespace ? { namespace } : {}),
        ...(collectCoverage ? { coverageMap: global.__coverage__ } : {}),
      }
    } catch (error) {
      if (error && error.code === "MODULE_PARSE_ERROR") {
        error.message = error.message.replace(
          file,
          ressourceToLocalSourceFile({ ressource: file, localRoot }),
        )
        throw error
      }
      if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
        throw error.error
      }
      throw error
    }
  }
}

export const platform = {
  setup,
  importFile: () => {
    throw new Error(`platform importFile must be called after setup`)
  },
}
