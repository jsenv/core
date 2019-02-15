import {
  resolveAPossibleNodeModuleFile,
  fileHrefToPathname,
  pathnameToFileHref,
} from "@jsenv/module-resolution"

export const locate = ({ projectFolder, compileInto, requestPathname }) => {
  const {
    compileId: requestCompileId,
    filenameRelative: requestFilenameRelative,
  } = requestPathnameToCompileIdAndProjectPathname(requestPathname, compileInto)

  if (!requestCompileId) return {}
  if (!requestFilenameRelative) return {}

  const compileId = requestCompileId
  const filenameRelative = requestFilenameRelative
  const filename = `${projectFolder}/${filenameRelative}`
  // it is possible that the file is in fact somewhere else
  // due to node_module resolution algorithm
  const moduleHrefOrNodeModuleHref = resolveAPossibleNodeModuleFile(pathnameToFileHref(filename))

  return {
    compileId,
    filenameRelative,
    filename: fileHrefToPathname(moduleHrefOrNodeModuleHref),
  }
}

const requestPathnameToCompileIdAndProjectPathname = (requestPathname = "", compileInto) => {
  if (requestPathname.startsWith(`${compileInto}/`) === false) {
    return {
      compileId: null,
      filenameRelative: null,
    }
  }

  const afterCompileInto = requestPathname.slice(`${compileInto}/`.length)
  const parts = afterCompileInto.split("/")

  const compileId = parts[0]
  if (compileId.length === 0) {
    return {
      compileId: null,
      filenameRelative: null,
    }
  }

  const filenameRelative = parts.slice(1).join("/")
  if (filenameRelative.length === 0) {
    return {
      compileId: null,
      filenameRelative,
    }
  }

  return {
    compileId,
    filenameRelative,
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
