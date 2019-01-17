import path from "path"
import Module from "module"
import { localRoot as selfLocalRoot } from "../localRoot.js"

export const locate = ({ requestFile, refererFile, compileInto, localRoot }) => {
  const {
    compileId: requestCompileId,
    projectFile: requestProjectFile,
  } = requestFileToCompileIdAndProjectFile(requestFile, compileInto)

  if (!requestCompileId) return {}
  if (!requestProjectFile) return {}

  const compileId = requestCompileId
  let projectFile = requestProjectFile

  // future consumer of dev-server will use
  // 'node_modules/dev-server/dist/browserSystemImporter.js'
  // to get file from this module
  // in order to test this behaviour, when we are working on this module
  // 'node_modules/dev-server` is an alias to localRoot
  if (localRoot === selfLocalRoot) {
    if (projectFile.startsWith("node_modules/dev-server/")) {
      projectFile = projectFile.slice("node_modules/dev-server/".length)
    }
  }

  if (projectFile.startsWith("node_modules/")) {
    const {
      compileId: refererCompileId,
      projectFile: refererProjectFile,
    } = requestFileToCompileIdAndProjectFile(refererFile, compileInto)

    const importerProjectFile =
      refererProjectFile &&
      refererProjectFile !== requestProjectFile &&
      refererCompileId === requestCompileId
        ? refererProjectFile
        : null

    if (importerProjectFile) {
      const importerProjectFolder = path.dirname(importerProjectFile)
      const nodeModuleFile = projectFileToNodeModuleFile(
        projectFile,
        `${localRoot}/${importerProjectFolder}`,
      )
      return { compileId, projectFile, file: nodeModuleFile }
    }

    const nodeModuleFile = projectFileToNodeModuleFile(
      projectFile,
      `${localRoot}/${path.dirname(projectFile)}`,
    )
    return { compileId, projectFile, file: nodeModuleFile }
  }

  return {
    compileId,
    projectFile,
    file: `${localRoot}/${projectFile}`,
  }
}

const requestFileToCompileIdAndProjectFile = (requestFile = "", compileInto) => {
  const parts = requestFile.split("/")
  const firstPart = parts[0]
  if (firstPart !== compileInto) {
    return {
      compileId: null,
      projectFile: null,
    }
  }

  const compileId = parts[1]
  if (compileId.length === 0) {
    return {
      compileId: null,
      projectFile: null,
    }
  }

  const projectFile = parts.slice(2).join("/")
  if (projectFile.length === 0) {
    return {
      compileId: null,
      projectFile,
    }
  }

  return {
    compileId,
    projectFile,
  }
}

const projectFileToNodeModuleFile = (projectFile, importerProjectFolder) => {
  const dependency = projectFile.slice("node_modules/".length)

  const requireContext = new Module(importerProjectFolder)
  requireContext.paths = Module._nodeModulePaths(importerProjectFolder)

  try {
    const file = Module._resolveFilename(dependency, requireContext, true)
    return file
  } catch (e) {
    if (e && e.code === "MODULE_NOT_FOUND") {
      return null
    }
    throw e
  }
}
