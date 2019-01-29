import { resolveAPossibleNodeModuleFile } from "@jsenv/module-resolution"

export const locate = ({ requestFile, compileInto, localRoot }) => {
  const {
    compileId: requestCompileId,
    projectFile: requestProjectFile,
  } = requestFileToCompileIdAndProjectFile(requestFile, compileInto)

  if (!requestCompileId) return {}
  if (!requestProjectFile) return {}

  const compileId = requestCompileId
  const projectFile = requestProjectFile
  const moduleFile = `${localRoot}/${projectFile}`
  // it is possible that the file is in fact somewhere else
  // due to node_module resolution algorithm
  const moduleFileOrNodeModuleFile = resolveAPossibleNodeModuleFile(moduleFile)

  return {
    compileId,
    projectFile,
    file: moduleFileOrNodeModuleFile,
  }
}

const requestFileToCompileIdAndProjectFile = (requestFile = "", compileInto) => {
  if (requestFile.startsWith(`${compileInto}/`) === false) {
    return {
      compileId: null,
      projectFile: null,
    }
  }

  const afterCompileInto = requestFile.slice(`${compileInto}/`.length)
  const parts = afterCompileInto.split("/")

  const compileId = parts[0]
  if (compileId.length === 0) {
    return {
      compileId: null,
      projectFile: null,
    }
  }

  const projectFile = parts.slice(1).join("/")
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

// unused now, referer now has zero impact on response
// const refererFileToModuleSpecifierFile = ({
//   refererFile,
//   projectFile,
//   compileInto,
//   compileId,
//   localRoot,
// }) => {
//   if (!refererFile) return null

//   const {
//     compileId: refererCompileId,
//     projectFile: refererProjectFile,
//   } = requestFileToCompileIdAndProjectFile(refererFile, compileInto)

//   if (!refererProjectFile) return null
//   if (refererProjectFile === projectFile) return null
//   if (refererCompileId !== compileId) return null

//   return `${localRoot}/${refererProjectFile}`
// }
