import { projectFileToNodeModuleFile } from "../projectFileToNodeModuleFile.js"

export const locate = ({ requestFile, refererFile, compileInto, localRoot }) => {
  const {
    compileId: requestCompileId,
    projectFile: requestProjectFile,
  } = requestFileToCompileIdAndProjectFile(requestFile, compileInto)

  if (!requestCompileId) return {}
  if (!requestProjectFile) return {}

  const compileId = requestCompileId
  const projectFile = requestProjectFile

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
      const nodeModuleFile = projectFileToNodeModuleFile(
        projectFile,
        `${localRoot}/${importerProjectFile}`,
      )
      return { compileId, projectFile, file: nodeModuleFile }
    }

    const nodeModuleFile = projectFileToNodeModuleFile(projectFile, `${localRoot}/${projectFile}`)
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
