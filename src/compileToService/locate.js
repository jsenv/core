import {
  resolveAPossibleNodeModuleFile,
  fileHrefToPathname,
  pathnameToFileHref,
} from "@jsenv/module-resolution"

export const locate = ({ root, compileInto, requestPathname }) => {
  const {
    compileId: requestCompileId,
    projectPathname: requestProjectPathname,
  } = requestPathnameToCompileIdAndProjectPathname(requestPathname, compileInto)

  if (!requestCompileId) return {}
  if (!requestProjectPathname) return {}

  const compileId = requestCompileId
  const projectPathname = requestProjectPathname
  const modulePathname = `${root}/${projectPathname}`
  // it is possible that the file is in fact somewhere else
  // due to node_module resolution algorithm
  const moduleHrefOrNodeModuleHref = resolveAPossibleNodeModuleFile(
    pathnameToFileHref(modulePathname),
  )

  return {
    compileId,
    projectPathname,
    filePathname: fileHrefToPathname(moduleHrefOrNodeModuleHref),
  }
}

const requestPathnameToCompileIdAndProjectPathname = (requestPathname = "", compileInto) => {
  if (requestPathname.startsWith(`${compileInto}/`) === false) {
    return {
      compileId: null,
      projectPathname: null,
    }
  }

  const afterCompileInto = requestPathname.slice(`${compileInto}/`.length)
  const parts = afterCompileInto.split("/")

  const compileId = parts[0]
  if (compileId.length === 0) {
    return {
      compileId: null,
      projectPathname: null,
    }
  }

  const projectPathname = parts.slice(1).join("/")
  if (projectPathname.length === 0) {
    return {
      compileId: null,
      projectPathname,
    }
  }

  return {
    compileId,
    projectPathname,
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
